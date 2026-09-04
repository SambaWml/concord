import { useEffect, useRef } from "react";
import { canShareScreen, useVoice } from "../hooks/useVoice.js";

function VideoTile({ stream, label, muted, isSelf, videoOff }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
  }, [stream]);
  return (
    <div className="voice-tile">
      <video ref={ref} autoPlay playsInline muted={muted} />
      {videoOff && (
        <div className="voice-tile-avatar">{label.slice(0, 1).toUpperCase()}</div>
      )}
      <span className="voice-tile-label">
        {label} {isSelf && "(você)"}
      </span>
    </div>
  );
}

function ScreenTile({ stream, label, muted }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
  }, [stream]);
  return (
    <div className="voice-stage-tile">
      <video ref={ref} autoPlay playsInline muted={muted} />
      <span className="voice-tile-label">🖥️ {label}</span>
    </div>
  );
}

export default function VoicePanel({ socket, myNickname }) {
  const voice = useVoice(socket);

  if (!voice.joined) {
    return (
      <div className="voice-panel voice-panel--idle">
        <p>Canal de voz Geral — ninguém precisa estar aqui pra você entrar.</p>
        {voice.error && <div className="login-error">{voice.error}</div>}
        <button className="voice-join-btn" onClick={voice.join}>
          🔊 Entrar na chamada
        </button>
      </div>
    );
  }

  const remoteSharing = Object.entries(voice.remoteScreenStreams);
  const hasStage = voice.sharingScreen || remoteSharing.length > 0;

  return (
    <div className="voice-panel">
      {hasStage && (
        <div className="voice-stage">
          {voice.sharingScreen && (
            <ScreenTile stream={voice.screenStream} label="Sua tela" muted />
          )}
          {remoteSharing.map(([socketId, stream]) => {
            const peer = voice.participants.find((p) => p.socketId === socketId);
            return (
              <ScreenTile
                key={socketId + "-screen"}
                stream={stream}
                label={`Tela de ${peer?.nickname || "alguém"}`}
              />
            );
          })}
        </div>
      )}

      <div className="voice-grid">
        <VideoTile
          stream={voice.localStream}
          label={myNickname}
          muted
          isSelf
          videoOff={!voice.cameraOn}
        />
        {voice.participants.map((p) => (
          <VideoTile
            key={p.socketId}
            stream={voice.remoteStreams[p.socketId]}
            label={p.nickname}
            videoOff={!voice.remoteStreams[p.socketId]?.getVideoTracks().some((t) => t.enabled)}
          />
        ))}
      </div>

      {voice.error && <div className="login-error">{voice.error}</div>}

      <div className="voice-controls">
        <button
          className={voice.muted ? "voice-btn voice-btn--off" : "voice-btn"}
          onClick={voice.toggleMute}
          title={voice.muted ? "Ativar microfone" : "Mutar microfone"}
        >
          {voice.muted ? "🔇" : "🎙️"}
        </button>
        <button
          className={voice.cameraOn ? "voice-btn" : "voice-btn voice-btn--off"}
          onClick={voice.toggleCamera}
          title={voice.cameraOn ? "Desligar câmera" : "Ligar câmera"}
        >
          {voice.cameraOn ? "📹" : "🚫"}
        </button>
        {canShareScreen && (
          <button
            className={
              voice.sharingScreen ? "voice-btn voice-btn--sharing" : "voice-btn"
            }
            onClick={voice.sharingScreen ? voice.stopScreenShare : voice.startScreenShare}
            title={voice.sharingScreen ? "Parar de compartilhar tela" : "Compartilhar tela"}
          >
            {voice.sharingScreen ? "🖥️ Parar de compartilhar" : "🖥️ Compartilhar tela"}
          </button>
        )}
        <button className="voice-btn voice-btn--leave" onClick={voice.leave}>
          Sair da chamada
        </button>
      </div>
    </div>
  );
}
