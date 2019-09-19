// this is for holding the user id in the request object
export interface State {
  user?: string;
}

// this is the interface for all json pagination responses on the api
export interface PaginationResults<T> {
  limit: number;
  result: T[];
  search?: string;
  next_page: number;
}
