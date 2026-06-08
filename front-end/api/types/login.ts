export type LoginRequest = {
    login: string; // Can be email or CPF
    password: string;
};


export type LoginResponse = {
    accessToken: string;
    refreshToken: string;
};