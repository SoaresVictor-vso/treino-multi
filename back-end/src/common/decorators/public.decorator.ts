import { SetMetadata } from '@nestjs/common';

/** Chave de metadata utilizada pelo JwtAuthGuard para identificar rotas públicas */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca a rota como pública — o JwtAuthGuard não exigirá token JWT.
 * Uso: @Public() acima do handler ou do controller.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
