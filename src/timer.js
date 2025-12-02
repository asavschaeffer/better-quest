import { SessionStatus } from "./models.js";

// Low-level countdown timer that is independent of any UI framework.
export class CountdownTimer {
  constructor({ durationMs, onTick, onCompleted, onCancelled, tickIntervalMs = 500 }) {
    this.durationMs = durationMs;
    this.onTick = onTick;
    this.onCompleted = onCompleted;
    this.onCancelled = onCancelled;
    this.tickIntervalMs = tickIntervalMs;

    this._startTime = null;
    this._elapsedMs = 0;
    this._intervalId = null;
    this._status = "idle"; // idle | running | paused | completed | cancelled
  }

  start() {
    if (this._status === "running") return;
    this._startTime = Date.now();
    this._status = "running";
    this._kickoffInterval();
  }

  pause() {
    if (this._status !== "running") return;
    this._clearInterval();
    this._elapsedMs += Date.now() - this._startTime;
    this._status = "paused";
  }

  resume() {
    if (this._status !== "paused") return;
    this._startTime = Date.now();
    this._status = "running";
    this._kickoffInterval();
  }

  cancel() {
    if (this._status === "completed" || this._status === "cancelled") return;
    this._clearInterval();
    this._status = "cancelled";
    if (this.onCancelled) this.onCancelled();
  }

  _kickoffInterval() {
    this._clearInterval();
    this._emitTick(); // immediate tick for up-to-date UI
    this._intervalId = setInterval(() => this._emitTick(), this.tickIntervalMs);
  }

  _emitTick() {
    if (this._status !== "running") return;

    const now = Date.now();
    const elapsed = this._elapsedMs + (now - this._startTime);
    const remaining = Math.max(0, this.durationMs - elapsed);

    if (this.onTick) {
      this.onTick({
        remainingMs: remaining,
        elapsedMs: elapsed,
        totalMs: this.durationMs,
      });
    }

    if (remaining <= 0) {
      this._clearInterval();
      this._status = "completed";
      if (this.onCompleted) this.onCompleted();
    }
  }

  _clearInterval() {
    if (this._intervalId != null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }
}

// SessionManager ties TaskSession lifecycle to the CountdownTimer.
export class SessionManager {
  constructor({ onSessionTick, onSessionCompleted, onSessionCancelled } = {}) {
    this.currentSession = null;
    this._timer = null;
    this._onSessionTick = onSessionTick;
    this._onSessionCompleted = onSessionCompleted;
    this._onSessionCancelled = onSessionCancelled;
  }

  startSession(session) {
    // Only one active session in the SLC.
    this.cancelSessionSilently();

    this.currentSession = {
      ...session,
      status: SessionStatus.RUNNING,
      remainingMs: session.durationMinutes * 60 * 1000,
    };

    const durationMs = this.currentSession.remainingMs;

    this._timer = new CountdownTimer({
      durationMs,
      onTick: ({ remainingMs, elapsedMs, totalMs }) => {
        if (!this.currentSession) return;
        this.currentSession = {
          ...this.currentSession,
          remainingMs,
          elapsedMs,
          totalMs,
        };
        if (this._onSessionTick) this._onSessionTick(this.currentSession);
      },
      onCompleted: () => {
        if (!this.currentSession) return;
        this.currentSession = {
          ...this.currentSession,
          status: SessionStatus.COMPLETED,
          endTime: new Date().toISOString(),
          remainingMs: 0,
        };
        if (this._onSessionCompleted) this._onSessionCompleted(this.currentSession);
      },
      onCancelled: () => {
        if (!this.currentSession) return;
        this.currentSession = {
          ...this.currentSession,
          status: SessionStatus.CANCELLED,
          endTime: new Date().toISOString(),
        };
        if (this._onSessionCancelled) this._onSessionCancelled(this.currentSession);
      },
    });

    this._timer.start();

    // Initial tick to propagate starting state.
    if (this._onSessionTick) this._onSessionTick(this.currentSession);

    return this.currentSession;
  }

  cancelSession() {
    if (this._timer) {
      this._timer.cancel();
    } else if (this.currentSession) {
      // No active timer but we had a session state; mark as cancelled.
      this.currentSession = {
        ...this.currentSession,
        status: SessionStatus.CANCELLED,
        endTime: new Date().toISOString(),
      };
      if (this._onSessionCancelled) this._onSessionCancelled(this.currentSession);
    }
    this._timer = null;
  }

  cancelSessionSilently() {
    if (this._timer) {
      this._timer._clearInterval();
      this._timer = null;
    }
    this.currentSession = null;
  }
}


