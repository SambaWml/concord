import { GtcrnWorkletNode, loadGtcrn } from "@sapphi-red/web-noise-suppressor";
import gtcrnWorkletUrl from "@sapphi-red/web-noise-suppressor/gtcrnWorklet.js?url";
import gtcrnWasmUrl from "@sapphi-red/web-noise-suppressor/gtcrn.wasm?url";

// Um AudioContext e um binário wasm só — reaproveitados se a pessoa sair e
// entrar na chamada de novo na mesma sessão, em vez de recarregar tudo.
let sharedContext = null;
let workletReadyPromise = null;
let wasmBinaryPromise = null;

function getAudioContext() {
  sharedContext ||= new (window.AudioContext || window.webkitAudioContext)();
  return sharedContext;
}

/**
 * Monta a cadeia de processamento do microfone: primeiro tira o ruído de
 * fundo (GTCRN, tipo Krisp), depois aplica o que faz a voz soar "na frente
 * da sala" em vez de "no fundo" — corte de grave/ronco, realce de presença
 * e compressão de dinâmica, a mesma receita que apps como Discord/Zoom
 * usam por trás. Tudo roda no navegador via Web Audio API.
 *
 * Cada estágio é opcional: se o GTCRN não carregar, segue só com o resto;
 * se nem Web Audio estiver disponível, cai pro áudio cru sem quebrar a
 * chamada.
 */
export async function suppressNoise(micStream) {
  const rawTrack = micStream.getAudioTracks()[0];
  if (!rawTrack) {
    return { stream: micStream, stop: () => {} };
  }

  let ctx;
  try {
    ctx = getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();
  } catch (err) {
    console.warn("Web Audio indisponível, usando áudio sem tratamento:", err);
    return { stream: micStream, stop: () => rawTrack.stop() };
  }

  const source = ctx.createMediaStreamSource(new MediaStream([rawTrack]));

  // 1. remove ruído de fundo (opcional — some sozinho se o navegador não suportar)
  let denoiser = null;
  try {
    workletReadyPromise ||= ctx.audioWorklet.addModule(gtcrnWorkletUrl);
    await workletReadyPromise;
    wasmBinaryPromise ||= loadGtcrn({ url: gtcrnWasmUrl });
    const wasmBinary = await wasmBinaryPromise;
    denoiser = new GtcrnWorkletNode(ctx, { maxChannels: 1, wasmBinary });
  } catch (err) {
    console.warn(
      "Supressor de ruído (GTCRN) indisponível, seguindo só com realce de voz:",
      err
    );
  }

  // 2. corta ronco/grave de ambiente — é parte do que faz a voz soar "de longe"
  const highPass = ctx.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = 90;

  // 3. realça a faixa de presença da voz — dá a sensação de mic de estúdio
  //    "na sua cara" em vez de captado do fundo do cômodo
  const presence = ctx.createBiquadFilter();
  presence.type = "highshelf";
  presence.frequency.value = 3200;
  presence.gain.value = 6;

  // 4. compressão: levanta os trechos baixos, controla os picos — é o que
  //    dá a sensação de "projeção" constante, perto do que o Discord faz
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -28;
  compressor.knee.value = 24;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.15;

  // 5. compensa o volume que a compressão "engoliu"
  const makeupGain = ctx.createGain();
  makeupGain.gain.value = 1.6;

  // 6. limitador de segurança — impede estourar (clipar) depois do ganho extra
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.1;

  const dest = ctx.createMediaStreamDestination();

  const chain = [source, denoiser, highPass, presence, compressor, makeupGain, limiter, dest].filter(
    Boolean
  );
  for (let i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1]);

  const cleanTrack = dest.stream.getAudioTracks()[0];
  // troca só a faixa de áudio pela versão tratada; o vídeo (se tiver)
  // continua sendo exatamente a mesma faixa da captura original.
  const combined = new MediaStream([cleanTrack, ...micStream.getVideoTracks()]);

  return {
    stream: combined,
    stop() {
      chain.forEach((node) => {
        try {
          node.disconnect();
        } catch {
          // pode já ter sido desconectado
        }
      });
      denoiser?.destroy?.();
      rawTrack.stop();
      cleanTrack.stop();
    },
  };
}
