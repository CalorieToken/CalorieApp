export const AUTH_STATE_CHANGED_EVENT = "calorieapp:auth-state-changed";

export type AuthStateChangedDetail = {
  authenticated: boolean;
};

export function announceAuthState(authenticated: boolean) {
  window.dispatchEvent(
    new CustomEvent<AuthStateChangedDetail>(AUTH_STATE_CHANGED_EVENT, {
      detail: { authenticated },
    })
  );
}
