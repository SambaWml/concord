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
 * Passa o microfone por um modelo de IA leve (GTCRN) que separa voz de
 * ruído de fundo em tempo real — a mesma ideia por trás do Krisp, só que
 * livre e rodando inteiramente no seu navegador (nada de áudio sai pra
 * nenhum servidor pra isso).
 *
 * Se o navegador não suportar (falta AudioWorklet, wasm falhou etc.), cai
 * de volta pro áudio cru sem quebrar a chamada.
 */
export async function suppressNoise(micStream) {
  const rawTrack = micStream.getAudioTracks()[0];
  if (!rawTrack) {
    return { stream: micStream, stop: () => {} };
  }

  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();

    workletReadyPromise ||= ctx.audioWorklet.addModule(gtcrnWorkletUrl);
    await workletReadyPromise;

    wasmBinaryPromise ||= loadGtcrn({ url: gtcrnWasmUrl });
    const wasmBinary = await wasmBinaryPromise;

    const source = ctx.createMediaStreamSource(new MediaStream([rawTrack]));
    const node = new GtcrnWorkletNode(ctx, { maxChannels: 1, wasmBinary });
    const dest = ctx.createMediaStreamDestination();
    source.connect(node).connect(dest);

    const cleanTrack = dest.stream.getAudioTracks()[0];
    // troca só a faixa de áudio pela versão tratada; o vídeo (se tiver)
    // continua sendo exatamente a mesma faixa da captura original.
    const combined = new MediaStream([cleanTrack, ...micStream.getVideoTracks()]);

    return {
      stream: combined,
      stop() {
        try {
          source.disconnect();
          node.disconnect();
          node.destroy();
        } catch {
          // pode já ter sido desconectado
        }
        rawTrack.stop();
        cleanTrack.stop();
      },
    };
  } catch (err) {
    console.warn("Supressão de ruído indisponível, usando áudio sem tratamento:", err);
    return { stream: micStream, stop: () => rawTrack.stop() };
  }
}
