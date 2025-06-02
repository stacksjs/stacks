export class Token {
  constructor(
    public accessToken: string,
    public refreshToken: string | null = null,
    public expiresIn: number | null = null,
    public approvedScopes: string[] = [],
  ) {}
}
