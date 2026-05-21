export interface ApiResponse<T> {
  code: number;
  success: boolean;
  message: string;
  data: T;
}

export interface PageInfo {
  totalNum: number;
  currentPage: number;
  linesPerPage: number;
  totalPage: number;
}

export interface PageResult<T> {
  list: T[];
  page: PageInfo;
}

/**
 * @author codex
 * Wraps successful business responses in the platform response envelope.
 */
export function ok<T>(data: T, message = 'ok'): ApiResponse<T> {
  return {
    code: 0,
    success: true,
    message,
    data,
  };
}

/**
 * @author codex
 * Creates the shared list response shape used by all .do list endpoints.
 */
export function pageResult<T>(
  list: T[],
  currentPage: number,
  linesPerPage: number,
  totalNum: number,
): PageResult<T> {
  return {
    list,
    page: {
      totalNum,
      currentPage,
      linesPerPage,
      totalPage: Math.ceil(totalNum / linesPerPage),
    },
  };
}
