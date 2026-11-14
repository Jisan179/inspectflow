/** Shape stored on req.user after the JWT strategy validates a token. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
}
