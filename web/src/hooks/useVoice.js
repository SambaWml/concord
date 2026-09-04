import { useCallback, useEffect, useRef, useState } from "react";

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

      localStreamRef.current
        ?.getTracks()
        .forEach((track) => pc.addTrack(track, localStreamRef.current));

      // se eu já estiver compartilhando a tela quando essa conexão nasce
      // (alguém entrou na chamada depois de eu já estar compartilhando),
      // a tela entra junto — mesmo que só caiba de fato numa renegociação
      // logo em seguida (ver handleSignal).
      if (screenStreamRef.current) {
        const senders = screenStreamRef.current
          .getTracks()
          .map((track) => pc.addTrack(track, screenStreamRef.current));
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
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      // câmera começa desligada — só o microfone entra ativo por padrão.
      stream.getVideoTracks().forEach((t) => (t.enabled = false));
      localStreamRef.current = stream;
      setLocalStream(stream);
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
        video: true,
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
        const senders = stream
          .getTracks()
          .map((track) => pc.addTrack(track, stream));
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
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
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
