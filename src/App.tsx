import { useEffect, useRef, useState } from "react";
import { useRadio } from "./hooks/useRadio";
import { configured, convexClient } from "./lib/convexClient";
import { getBackend } from "./lib/radio/convexBackend";
import { api } from "../convex/_generated/api";
import {
  loadKeepAwake,
  loadDisplayName,
  saveDisplayName,
} from "./lib/radio/session";
import { PTTButton } from "./components/PTTButton";

const CHANNEL = "instrumentation";
function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <i aria-hidden="true" />
    </label>
  );
}
function readInvite() {
  const params = new URLSearchParams(location.hash.slice(1));
  const invite = params.get("invite") || "";
  return invite;
}
export default function App() {
  const radio = useRadio();
  const { state } = radio;
  const [name, setName] = useState(loadDisplayName);
  const [token, setToken] = useState(readInvite);
  useEffect(() => {
    if (location.hash)
      history.replaceState(null, "", location.pathname + location.search);
  }, []);
  const [code, setCode] = useState("");
  const [tab, setTab] = useState("Radio");
  const [channelName, setChannelName] = useState("Instrumentation Team");
  const [awake, setAwake] = useState(loadKeepAwake);
  const [notice, setNotice] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [mic, setMic] = useState("");
  const [output, setOutput] = useState("");
  const [owner, setOwner] = useState("");
  const [newName, setNewName] = useState("");
  const online = state.connection === "online";
  const audioWarning = Object.values(state.peerStates).includes("failed")
    ? "Some team audio links failed. Open Settings and tap Reconnect."
    : "";
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);
  const connected = state.screen === "channel";
  const [preparing, setPreparing] = useState(false);
  const connectEpoch = useRef(0);
  const working =
    preparing ||
    state.joining ||
    state.connection === "connecting" ||
    state.connection === "reconnecting";
  useEffect(() => {
    if (connected)
      void navigator.mediaDevices
        ?.enumerateDevices()
        .then(setDevices)
        .catch(() => {});
  }, [connected]);
  async function connect() {
    if (preparing) return;
    const epoch = ++connectEpoch.current;
    setPreparing(true);
    setNotice("");
    getBackend().setRoomToken(token);
    try {
      const info = await convexClient.query(api.access.info, {
        channel: CHANNEL,
        roomToken: token,
        accessCode: code,
      });
      if (epoch !== connectEpoch.current) return;
      setChannelName(info.name);
      await radio.join(name.trim(), CHANNEL, code);
    } catch {
      if (epoch === connectEpoch.current)
        setNotice(
          "Could not join. Check your invitation, access code and internet connection.",
        );
    } finally {
      if (epoch === connectEpoch.current) setPreparing(false);
    }
  }
  function cancel() {
    ++connectEpoch.current;
    setPreparing(false);
    radio.leave();
  }
  function mode(on: boolean) {
    if (on) void connect();
    else cancel();
  }
  async function invite() {
    try {
      const link = new URL(location.origin + location.pathname);
      link.hash = new URLSearchParams({ invite: token }).toString();
      await navigator.clipboard.writeText(link.toString());
      setNotice("Invitation copied. Share the access code separately.");
    } catch {
      setNotice(
        "Clipboard unavailable. Ask your team lead to resend the original private invitation.",
      );
    }
  }
  async function rename() {
    try {
      const result = await convexClient.mutation(api.access.rename, {
        channel: CHANNEL,
        ownerToken: owner,
        name: newName,
      });
      setChannelName(result.name);
      setOwner("");
      setNewName("");
      setNotice("Channel name updated.");
    } catch {
      setNotice("Channel name could not be changed. Check the owner key.");
    }
  }
  if (!configured)
    return (
      <main className="setup">
        <div className="brand-mark">
          S<span>)))</span>
        </div>
        <h1>Satish Talk</h1>
        <p>Private team radio</p>
        <section>
          <h2>Setup required</h2>
          <p>
            Connect a separate Satish Talk Convex project before using the
            radio. Follow SETUP.md in the repository.
          </p>
          <p>No microphone or communication session is active.</p>
        </section>
        <small>Routine communication only. Not an emergency radio.</small>
      </main>
    );
  const speaker = state.talking
    ? "You are speaking"
    : state.floor
      ? `${state.floor.name} is speaking`
      : online
        ? "Ready to talk"
        : working
          ? "Connecting to your team…"
          : "Radio is offline";
  return (
    <div className="app-shell">
      <header>
        <a className="brand" href="/" aria-label="Satish Talk home">
          <span className="brand-mark">
            S<span>)))</span>
          </span>
          <span>
            Satish <b>Talk</b>
            <small>Private team radio</small>
          </span>
        </a>
        <button
          className="icon-button"
          onClick={() => setTab("Settings")}
          aria-label="Open settings"
        >
          ⚙
        </button>
      </header>
      <main>
        <div className="channel-heading">
          <div>
            <span className="eyebrow">Your channel</span>
            <h1>{channelName}</h1>
          </div>
          <span
            className={`status ${online ? "online" : working ? "connecting" : "offline"}`}
          >
            <i />
            {online ? "Online" : working ? "Connecting" : "Offline"}
          </span>
        </div>
        <div className="connection-line">
          <span>◉ {online ? state.members.length : 0} / 10 connected</span>
          <span>
            {online
              ? "Internet connected"
              : navigator.onLine
                ? "Internet available"
                : "No internet"}
          </span>
        </div>
        {(notice || state.joinError || audioWarning) && (
          <p className="notice" role="status">
            {notice || state.joinError || audioWarning}
          </p>
        )}
        {tab === "Radio" && (
          <>
            {!connected && (
              <section className="join-panel">
                <h2>Join your team</h2>
                <div className="fields">
                  <label>
                    Your display name
                    <input
                      autoComplete="nickname"
                      maxLength={32}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        saveDisplayName(e.target.value);
                      }}
                      placeholder="e.g. Satish"
                    />
                  </label>
                  <label>
                    Private invitation token
                    <input
                      type="password"
                      autoComplete="off"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Open your invite or paste token"
                    />
                  </label>
                  <label>
                    Channel access code
                    <input
                      type="password"
                      autoComplete="off"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Ask your team lead"
                    />
                  </label>
                </div>
              </section>
            )}
            <section className="mode-panel">
              <Toggle
                label="Walkie-Talkie Mode"
                checked={connected}
                disabled={
                  !connected &&
                  (working || name.trim().length < 2 || !token || !code)
                }
                onChange={mode}
              />
              <p>
                {connected
                  ? "Listening on this channel. Hold the button to speak."
                  : working
                    ? "Establishing a secure session…"
                    : "Turn on to connect your microphone and receive audio."}
              </p>
              {working && (
                <button className="text-button" onClick={cancel}>
                  Cancel connection
                </button>
              )}
            </section>
            <section className="talk-panel">
              <p className="speaker" role="status" aria-live="polite">
                <i className={state.talking ? "lit" : ""} />
                {speaker}
              </p>
              <PTTButton
                disabled={!online}
                disconnected={
                  state.connection === "error" ||
                  state.connection === "reconnecting"
                }
                talking={state.talking}
                busy={
                  state.busy ||
                  Boolean(
                    state.floor && state.floor.sessionId !== state.sessionId,
                  )
                }
                requesting={state.requesting}
                onStart={() => void radio.pressPTT()}
                onEnd={radio.releasePTT}
              />
              <p className="talk-hint">
                One speaker at a time. Release to listen.
              </p>
            </section>
            <div className="quick-row">
              <button onClick={() => setTab("Members")}>
                ♧ <span>Team members</span>
                <b>{state.members.length}</b>
              </button>
              <button onClick={() => void invite()} disabled={!connected}>
                ↗ <span>Invite member</span>
              </button>
            </div>
          </>
        )}
        {tab === "Members" && (
          <section className="list-panel">
            <div className="section-title">
              <h2>Team members</h2>
              <button disabled={!connected} onClick={() => void invite()}>
                Invite member
              </button>
            </div>
            <p>{online ? state.members.length : 0} connected · Maximum 10</p>
            {!connected && <p>Turn Walkie-Talkie Mode on to see your team.</p>}
            <ul className="members">
              {state.members.map((m) => (
                <li key={m.sessionId}>
                  <span className="avatar">
                    {m.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <strong>
                      {m.name}
                      {m.sessionId === state.sessionId ? " (you)" : ""}
                    </strong>
                    <small>
                      {state.floor?.sessionId === m.sessionId
                        ? "Speaking"
                        : m.sessionId === state.sessionId
                          ? "Connected"
                          : state.peerStates[m.sessionId] === "connected"
                            ? "Audio connected"
                            : state.peerStates[m.sessionId] === "failed" ? "Audio disconnected" : "Audio linking"}
                    </small>
                  </div>
                  <i
                    className={`member-dot ${m.sessionId === state.sessionId || state.peerStates[m.sessionId] === "connected" ? "active" : ""}`}
                  />
                </li>
              ))}
            </ul>
            <p className="muted">
              Offline members disappear after their session expires. Names are
              not a permanent identity directory.
            </p>
          </section>
        )}
        {tab === "Settings" && (
          <section className="settings-panel">
            <h2>Radio settings</h2>
            <Toggle
              label="Walkie-Talkie Mode"
              checked={connected}
              disabled={
                !connected &&
                (working || name.trim().length < 2 || !token || !code)
              }
              onChange={mode}
            />
            <Toggle
              label="Keep Screen Awake"
              checked={awake}
              onChange={(on) => {
                setAwake(on);
                radio.setKeepAwake(on);
              }}
            />
            <p className="muted">
              {state.wakeLock === "active"
                ? "Screen wake lock active."
                : state.wakeLock === "unavailable"
                  ? "Screen wake lock unavailable in this browser."
                  : "Keeps the screen on while the radio is active and visible."}{" "}
              May increase battery use.
            </p>
            <label>
              Microphone
              <select
                value={mic}
                onChange={(e) => {
                  setMic(e.target.value);
                  void radio.setMicrophone(e.target.value);
                }}
              >
                <option value="">System default</option>
                {devices
                  .filter((d) => d.kind === "audioinput")
                  .map((d) => (
                    <option value={d.deviceId} key={d.deviceId}>
                      {d.label || "Microphone"}
                    </option>
                  ))}
              </select>
            </label>
            <p className="muted">
              Microphone: {state.micPermission}. Changing microphone reconnects
              your radio.
            </p>
            <label>
              Audio output
              <select
                value={output}
                disabled={!("setSinkId" in HTMLMediaElement.prototype)}
                onChange={(e) => {
                  setOutput(e.target.value);
                  void radio
                    .setOutput(e.target.value)
                    .catch(() =>
                      setNotice(
                        "Audio output could not be changed. Use your device settings.",
                      ),
                    );
                }}
              >
                <option value="">System default</option>
                {devices
                  .filter((d) => d.kind === "audiooutput")
                  .map((d) => (
                    <option value={d.deviceId} key={d.deviceId}>
                      {d.label || "Speaker"}
                    </option>
                  ))}
              </select>
            </label>
            <p className="muted">
              Use your phone’s media volume. Headsets and Bluetooth follow
              browser and device support.
            </p>
            <div className="button-row">
              <button
                disabled={!connected}
                onClick={() => void radio.reconnect()}
              >
                Reconnect
              </button>
              <button
                className="danger"
                onClick={() => {
                  cancel();
                  setToken("");
                  setCode("");
                  setTab("Radio");
                }}
              >
                Leave channel
              </button>
            </div>
            <details>
              <summary>Channel owner controls</summary>
              <label>
                New channel name
                <input
                  maxLength={48}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </label>
              <label>
                Owner key
                <input
                  type="password"
                  autoComplete="off"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                />
              </label>
              <button
                disabled={!owner || !newName.trim()}
                onClick={() => void rename()}
              >
                Update channel name
              </button>
              <p className="muted">
                Rotate the invitation token and access code in your Convex
                environment to revoke access. Never share the owner key.
              </p>
            </details>
            <details>
              <summary>Install on your phone</summary>
              <p>
                Android Chrome: menu → Add to Home screen. iPhone Safari: Share
                → Add to Home Screen. Internet is required for voice.
              </p>
            </details>
          </section>
        )}
        <aside className="safety-note">
          Keep the app visible for reliable audio. Locked screens and background
          browsers can suspend communication. Routine communication only; not an
          emergency radio.
        </aside>
      </main>
      <nav aria-label="Main navigation">
        {["Radio", "Members", "Settings"].map((item, i) => (
          <button
            key={item}
            className={tab === item ? "selected" : ""}
            aria-current={tab === item ? "page" : undefined}
            onClick={() => setTab(item)}
          >
            <span aria-hidden="true">{["◉", "♧", "⚙"][i]}</span>
            {item}
          </button>
        ))}
      </nav>
    </div>
  );
}
