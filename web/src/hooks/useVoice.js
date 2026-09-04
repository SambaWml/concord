import { useCallback, useEffect, useRef, useState } from "react";
import { suppressNoise } from "./noiseSuppression.js";

// STUN público (grátis) resolve a maioria das redes domésticas. Se quiser
// mais confiabilidade em redes corporativas/4G, configure um TURN gratuito
// (ex: metered.ca) via essas variáveis de ambiente do Vite no build do front.
const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
if (import.meta.env.VITE_TURN_URL) {
  iceServers.push({
    urls: import.meta.env.VITE_TURN_URL,
    username: import.meta.env.VITE_TURN_USERNAME,
    credential: import.meta.env.VITE_TURN_CREDENTIAL,
  });
}

export const canShareScreen =
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

// Sem esses tetos, o WebRTC tenta mandar vídeo em bitrate mais alto do que
// a rede aguenta — e é exatamente esse congestionamento que aparece como
// lag/travamento, principalmente na malha (cada pessoa manda vídeo pra
// todo mundo ao mesmo tempo, dividindo o upload disponível).
const WEBCAM_MAX_BITRATE = 500_000; // ~500kbps é de sobra pra um tile pequeno
const SCREEN_MAX_BITRATE = 1_500_000; // tela pede mais nitidez, mas sem exagerar

function tuneVideoSender(sender, { maxBitrate, degradationPreference = "maintain-framerate" } = {}) {
  if (!sender || sender.track?.kind !== "video") return;
  try {
    const params = sender.getParameters();
    params.encodings = params.encodings?.length ? params.encodings : [{}];
    if (maxBitrate) params.encodings[0].maxBitrate = maxBitrate;
    // prioriza manter o vídeo fluido (sem travar) reduzindo nitidez, em vez
    // de derrubar o frame rate quando a rede aperta.
    params.degradationPreference = degradationPreference;
    sender.setParameters(params).catch(() => {});
  } catch {
    // navegador não suporta ajustar isso — segue com o padrão dele
  }
}

export function useVoice(socket) {
  const [joined, setJoined] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> MediaStream (câmera/mic)
  const [screenStream, setScreenStream] = useState(null); // minha tela, se eu estiver compartilhando
  const [remoteScreenStreams, setRemoteScreenStreams] = useState({}); // socketId -> MediaStream (tela)
  const [sharingScreen, setSharingScreen] = useState(false);
  const [participants, setParticipants] = useState([]); // roster do servidor
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState("");

  const peersRef = useRef(new Map()); // socketId -> RTCPeerConnection
  const localStreamRef = useRef(null);
  const noiseSuppressionRef = useRef(null); // { stream, stop() } de suppressNoise()
  const screenStreamRef = useRef(null);
  const screenSendersRef = useRef(new Map()); // socketId -> RTCRtpSender[] (faixas da tela)

  const renegotiateWith = useCallback(
    async (peerId) => {
      const pc = peersRef.current.get(peerId);
      if (!pc || pc.signalingState !== "stable") return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("voice:signal", { to: peerId, description: offer });
      } catch (err) {
        console.error("falha ao renegociar com", peerId, err);
      }
    },
    [socket]
  );

  const createPeer = useCallback(
    (peerId) => {
      const pc = new RTCPeerConnection({ iceServers });

      localStreamRef.current?.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, localStreamRef.current);
        tuneVideoSender(sender, { maxBitrate: WEBCAM_MAX_BITRATE });
      });

      // se eu já estiver compartilhando a tela quando essa conexão nasce
      // (alguém entrou na chamada depois de eu já estar compartilhando),
      // a tela entra junto — mesmo que só caiba de fato numa renegociação
      // logo em seguida (ver handleSignal).
      if (screenStreamRef.current) {
        const senders = screenStreamRef.current.getTracks().map((track) => {
          const sender = pc.addTrack(track, screenStreamRef.current);
          tuneVideoSender(sender, { maxBitrate: SCREEN_MAX_BITRATE });
          return sender;
        });
        screenSendersRef.current.set(peerId, senders);
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("voice:signal", { to: peerId, candidate: e.candidate });
        }
      };

      pc.ontrack = (e) => {
        const stream = e.streams[0];
        setRemoteStreams((prev) => {
          const current = prev[peerId];
          // a primeira stream que chega de alguém é câmera+mic; qualquer
          // stream *diferente* que chegue depois só pode ser a tela dela.
          if (!current || current.id === stream.id) {
            return { ...prev, [peerId]: stream };
          }
          setRemoteScreenStreams((p2) => ({ ...p2, [peerId]: stream }));
          return prev;
        });
      };

      peersRef.current.set(peerId, pc);
      return pc;
    },
    [socket]
  );

  const closePeer = useCallback((peerId) => {
    const pc = peersRef.current.get(peerId);
    if (pc) {
      pc.close();
      peersRef.current.delete(peerId);
    }
    screenSendersRef.current.delete(peerId);
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
    setRemoteScreenStreams((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, []);

  useEffect(() => {
    async function handleExistingPeers(peers) {
      // essa lista é o roster inicial de quem já está na chamada — sem isso,
      // quem acabou de entrar não sabe pra quem desenhar um tile de vídeo.
      setParticipants(peers);
      for (const p of peers) {
        const pc = createPeer(p.socketId);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("voice:signal", { to: p.socketId, description: offer });
        } catch (err) {
          console.error("falha ao ofertar pra", p.socketId, err);
        }
      }
    }

    async function handleSignal({ from, description, candidate }) {
      const isNewPeer = !peersRef.current.has(from);
      let pc = peersRef.current.get(from);
      if (description) {
        if (description.type === "offer") {
          if (!pc) pc = createPeer(from);
          await pc.setRemoteDescription(description);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("voice:signal", { to: from, description: answer });
          if (isNewPeer && screenStreamRef.current) {
            // a primeira resposta só cobre o que veio na oferta (mic/câmera
            // de quem chegou) — a tela, adicionada em createPeer, precisa
            // de uma rodada extra pra ganhar seu próprio "m-line".
            await renegotiateWith(from);
          }
        } else if (description.type === "answer" && pc) {
          await pc.setRemoteDescription(description);
        }
      } else if (candidate && pc) {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          // candidato que chegou tarde demais não é motivo pra derrubar a chamada
        }
      }
    }

    function handleRoster(roster) {
      setParticipants(roster);
    }

    function handlePeerLeft({ socketId }) {
      closePeer(socketId);
    }

    function handleScreenShareUpdate({ socketId, sharing }) {
      if (!sharing) {
        setRemoteScreenStreams((prev) => {
          const next = { ...prev };
          delete next[socketId];
          return next;
        });
      }
    }

    socket.on("voice:existing-peers", handleExistingPeers);
    socket.on("voice:signal", handleSignal);
    socket.on("voice:roster", handleRoster);
    socket.on("voice:peer-left", handlePeerLeft);
    socket.on("voice:screen-share", handleScreenShareUpdate);

    return () => {
      socket.off("voice:existing-peers", handleExistingPeers);
      socket.off("voice:signal", handleSignal);
      socket.off("voice:roster", handleRoster);
      socket.off("voice:peer-left", handlePeerLeft);
      socket.off("voice:screen-share", handleScreenShareUpdate);
    };
  }, [socket, createPeer, closePeer, renegotiateWith]);

  const join = useCallback(async () => {
    setError("");
    // supressão de ruído + cancelamento de eco + ganho automático — o
    // navegador já processa isso antes do áudio sair do seu computador.
    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
    // câmera pequena, 24fps — de sobra pra um tile de chamada, e bem mais
    // leve de codificar/transmitir do que a resolução máxima da webcam.
    const videoConstraints = {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 24, max: 30 },
    };
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: videoConstraints,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      }
      // câmera começa desligada — só o microfone entra ativo por padrão.
      stream.getVideoTracks().forEach((t) => (t.enabled = false));

      // troca o áudio cru por uma versão tratada por IA (tipo Krisp), se o
      // navegador suportar — se não der, usa o áudio original mesmo assim.
      const ns = await suppressNoise(stream);
      noiseSuppressionRef.current = ns;

      localStreamRef.current = ns.stream;
      setLocalStream(ns.stream);
      setMuted(false);
      setCameraOn(false);
      socket.emit("voice:join");
      setJoined(true);
    } catch (err) {
      console.error(err);
      setError("Não foi possível acessar seu microfone.");
    }
  }, [socket]);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    setSharingScreen(false);
    setError("");
    socket.emit("voice:screen-share", { sharing: false });

    peersRef.current.forEach((pc, peerId) => {
      const senders = screenSendersRef.current.get(peerId) || [];
      senders.forEach((sender) => {
        try {
          pc.removeTrack(sender);
        } catch {
          // conexão pode já estar fechada, tanto faz
        }
      });
      screenSendersRef.current.delete(peerId);
      renegotiateWith(peerId);
    });
  }, [socket, renegotiateWith]);

  const startScreenShare = useCallback(async () => {
    if (!canShareScreen) {
      setError("Seu navegador não suporta compartilhar tela.");
      return;
    }
    setError("");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        // a maioria do que se compartilha (texto, apps) não precisa de 60fps
        // — travar em ~24-30fps evita que o encoder exija mais banda do que
        // a rede tem, que é a causa mais comum de lag no compartilhamento.
        video: {
          frameRate: { ideal: 24, max: 30 },
          width: { max: 1920 },
          height: { max: 1080 },
        },
        audio: true,
        // hints que só Chrome/Edge entendem: pré-marca "compartilhar áudio
        // do sistema" quando a pessoa escolhe "Tela inteira" (sem isso o
        // checkbox some desmarcado por padrão) e tira a própria aba do
        // Concord da lista de opções pra compartilhar.
        systemAudio: "include",
        selfBrowserSurface: "exclude",
      });

      if (stream.getAudioTracks().length === 0) {
        setError(
          'Tela compartilhada sem áudio. Isso é o navegador, não um bug: ' +
            'compartilhar uma "Janela" nunca leva som. Pra levar o áudio de ' +
            'um vídeo, escolha "Guia do Chrome" (aba) ou marque ' +
            '"Compartilhar áudio do sistema" ao escolher "Tela inteira".'
        );
      }

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setSharingScreen(true);
      socket.emit("voice:screen-share", { sharing: true });

      peersRef.current.forEach((pc, peerId) => {
        const senders = stream.getTracks().map((track) => {
          const sender = pc.addTrack(track, stream);
          tuneVideoSender(sender, { maxBitrate: SCREEN_MAX_BITRATE });
          return sender;
        });
        screenSendersRef.current.set(peerId, senders);
        renegotiateWith(peerId);
      });

      // se a pessoa clicar em "Parar de compartilhar" no próprio popup do
      // navegador (em vez do nosso botão), a gente detecta e limpa também.
      stream.getVideoTracks()[0].addEventListener("ended", stopScreenShare);
    } catch (err) {
      console.error(err);
      // usuário cancelou o picker de tela — não é bem um "erro"
    }
  }, [socket, renegotiateWith, stopScreenShare]);

  const leave = useCallback(() => {
    if (screenStreamRef.current) stopScreenShare();
    socket.emit("voice:leave");
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    // vídeo para direto; áudio passa pelo cleanup da supressão de ruído,
    // que também libera o microfone cru por trás dela.
    localStreamRef.current?.getVideoTracks().forEach((t) => t.stop());
    noiseSuppressionRef.current?.stop();
    noiseSuppressionRef.current = null;
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStreams({});
    setRemoteScreenStreams({});
    setParticipants([]);
    setJoined(false);
  }, [socket, stopScreenShare]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localStreamRef.current
      ?.getAudioTracks()
      .forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const next = !cameraOn;
    localStreamRef.current
      ?.getVideoTracks()
      .forEach((t) => (t.enabled = next));
    setCameraOn(next);
  }, [cameraOn]);

  // sai da chamada automaticamente se a aba fechar
  useEffect(() => {
    return () => {
      if (joined) leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    joined,
    localStream,
    remoteStreams,
    screenStream,
    remoteScreenStreams,
    sharingScreen,
    participants,
    muted,
    cameraOn,
    error,
    join,
    leave,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
  };
}
