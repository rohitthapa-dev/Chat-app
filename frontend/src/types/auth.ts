export interface AuthUser {
  userId: string;
  username: string;
}

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
}
