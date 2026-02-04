/**
 * Error classifier - converts yt-dlp and network errors to structured errors
 */

import { Platform } from '../types/platform.types.js';
import {
  ErrorCode,
  ErrorType,
  StructuredError,
  ErrorClassification,
  ERROR_PATTERNS,
  createStructuredError,
} from '../types/error.types.js';

export class ErrorClassifier {
  /**
   * Classify an error message and return structured error
   */
  static classify(
    errorMessage: string,
    options?: {
      platform?: Platform;
      requestId?: string;
      attempts?: number;
    }
  ): StructuredError {
    const classification = this.getClassification(errorMessage);

    return createStructuredError(classification.code, classification.type, this.humanizeMessage(errorMessage, classification), {
      platform: options?.platform,
      cause: errorMessage,
      retryable: classification.retryable,
      suggestedAction: classification.suggestedAction,
      requestId: options?.requestId,
      attempts: options?.attempts,
    });
  }

  /**
   * Get classification for error message
   */
  static getClassification(errorMessage: string): ErrorClassification {
    // Check against known patterns
    for (const { pattern, classification } of ERROR_PATTERNS) {
      if (pattern.test(errorMessage)) {
        return classification;
      }
    }

    // Default classification for unknown errors
    return {
      code: ErrorCode.INTERNAL_UNKNOWN,
      type: ErrorType.INTERNAL,
      retryable: false,
      suggestedAction: 'Check the error message and try again',
    };
  }

  /**
   * Check if error indicates yt-dlp needs update
   */
  static needsYtDlpUpdate(errorMessage: string): boolean {
    const updateIndicators = [
      'unable to extract',
      'please report this issue',
      'unsupported url',
      'http error 403',
      'sign in to confirm',
    ];

    const lowerMessage = errorMessage.toLowerCase();
    return updateIndicators.some((indicator) => lowerMessage.includes(indicator));
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(errorMessage: string): boolean {
    return this.getClassification(errorMessage).retryable;
  }

  /**
   * Convert technical error to user-friendly message
   */
  static humanizeMessage(errorMessage: string, classification?: ErrorClassification): string {
    const classif = classification || this.getClassification(errorMessage);

    const messages: Record<ErrorCode, string> = {
      // Network errors
      [ErrorCode.NETWORK_TIMEOUT]: 'Conexão expirou. Tente novamente.',
      [ErrorCode.NETWORK_UNREACHABLE]: 'Não foi possível conectar. Verifique sua conexão.',
      [ErrorCode.NETWORK_DNS_FAILURE]: 'Falha ao resolver o endereço. Verifique sua conexão.',
      [ErrorCode.NETWORK_CONNECTION_RESET]: 'Conexão interrompida. Tente novamente.',

      // Platform errors
      [ErrorCode.PLATFORM_VIDEO_UNAVAILABLE]: 'Vídeo não disponível ou removido.',
      [ErrorCode.PLATFORM_VIDEO_PRIVATE]: 'Este vídeo é privado.',
      [ErrorCode.PLATFORM_VIDEO_REMOVED]: 'O vídeo foi removido.',
      [ErrorCode.PLATFORM_VIDEO_AGE_RESTRICTED]: 'Vídeo com restrição de idade.',
      [ErrorCode.PLATFORM_RATE_LIMITED]: 'Muitas requisições. Aguarde um momento.',
      [ErrorCode.PLATFORM_BLOCKED]: 'Acesso bloqueado. Tente novamente em instantes.',
      [ErrorCode.PLATFORM_AUTH_REQUIRED]: 'Vídeo requer autenticação.',
      [ErrorCode.PLATFORM_GEO_RESTRICTED]: 'Vídeo não disponível em sua região.',

      // Format errors
      [ErrorCode.FORMAT_NOT_AVAILABLE]: 'Formato não disponível. Tente outra qualidade.',
      [ErrorCode.FORMAT_EXTRACTION_FAILED]: 'Falha ao processar vídeo. Atualizando...',
      [ErrorCode.FORMAT_MERGE_FAILED]: 'Falha ao processar áudio/vídeo.',

      // Download errors
      [ErrorCode.DOWNLOAD_TIMEOUT]: 'Download expirou. Tente novamente.',
      [ErrorCode.DOWNLOAD_ABORTED]: 'Download cancelado.',
      [ErrorCode.DOWNLOAD_FILE_TOO_LARGE]: 'Arquivo muito grande.',
      [ErrorCode.DOWNLOAD_DURATION_EXCEEDED]: 'Vídeo muito longo.',
      [ErrorCode.DOWNLOAD_DISK_FULL]: 'Espaço em disco insuficiente.',

      // Validation errors
      [ErrorCode.VALIDATION_INVALID_URL]: 'URL inválida.',
      [ErrorCode.VALIDATION_UNSUPPORTED_PLATFORM]: 'Plataforma não suportada. Use YouTube, TikTok ou Twitter/X.',
      [ErrorCode.VALIDATION_MISSING_PARAMETER]: 'Parâmetro obrigatório faltando.',

      // Internal errors
      [ErrorCode.INTERNAL_YTDLP_ERROR]: 'Erro interno. Tente novamente.',
      [ErrorCode.INTERNAL_YTDLP_UPDATE_NEEDED]: 'Atualizando sistema. Tente novamente em instantes.',
      [ErrorCode.INTERNAL_YTDLP_NOT_FOUND]: 'Serviço não configurado corretamente.',
      [ErrorCode.INTERNAL_PROCESS_ERROR]: 'Erro interno. Tente novamente.',
      [ErrorCode.INTERNAL_UNKNOWN]: 'Erro desconhecido. Tente novamente.',

      // Queue errors
      [ErrorCode.QUEUE_TIMEOUT]: 'Tempo de espera excedido. Tente novamente.',
      [ErrorCode.RATE_LIMITED]: 'Limite de requisições atingido. Aguarde um momento.',
      [ErrorCode.CIRCUIT_BREAKER_OPEN]: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
    };

    return messages[classif.code] || 'Erro desconhecido. Verifique a URL e tente novamente.';
  }

  /**
   * Get HTTP status code for error
   */
  static getHttpStatus(code: ErrorCode): number {
    const statusMap: Partial<Record<ErrorCode, number>> = {
      [ErrorCode.VALIDATION_INVALID_URL]: 400,
      [ErrorCode.VALIDATION_UNSUPPORTED_PLATFORM]: 400,
      [ErrorCode.VALIDATION_MISSING_PARAMETER]: 400,
      [ErrorCode.RATE_LIMITED]: 429,
      [ErrorCode.PLATFORM_RATE_LIMITED]: 429,
      [ErrorCode.QUEUE_TIMEOUT]: 408,
      [ErrorCode.DOWNLOAD_TIMEOUT]: 408,
      [ErrorCode.NETWORK_TIMEOUT]: 504,
      [ErrorCode.PLATFORM_VIDEO_UNAVAILABLE]: 404,
      [ErrorCode.PLATFORM_VIDEO_REMOVED]: 404,
      [ErrorCode.PLATFORM_VIDEO_PRIVATE]: 403,
      [ErrorCode.PLATFORM_AUTH_REQUIRED]: 401,
      [ErrorCode.CIRCUIT_BREAKER_OPEN]: 503,
    };

    return statusMap[code] || 500;
  }
}
