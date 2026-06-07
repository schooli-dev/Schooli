export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  error: {
    code: string;
    details?: unknown;
  };
};
