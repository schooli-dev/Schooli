import type { Response } from "express";

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ApiResponseOptions<T> = {
  statusCode?: number;
  message: string;
  data?: T;
  pagination?: Pagination;
};

export function sendSuccess<T>(res: Response, options: ApiResponseOptions<T>): void {
  res.status(options.statusCode ?? 200).json({
    success: true,
    message: options.message,
    data: options.data,
    pagination: options.pagination
  });
}
