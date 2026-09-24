export type LoginRequest = {
	login: string; // Can be email or CPF
	password: string;
	rememberMe?: boolean;
};

export type LoginResponse = {
	accessToken: string;
	refreshToken: string;
	rememberMe: boolean;
};
