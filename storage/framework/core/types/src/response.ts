export interface ResponseInstance {
  json: (data: any, status?: number) => ResponseData
  success: (data: any) => ResponseData
  created: (data: any) => ResponseData
  noContent: () => ResponseData
  error: (message: string, status: number) => ResponseData
  forbidden: (message: string) => ResponseData
  unauthorized: (message: string) => ResponseData
  notFound: (message: string) => ResponseData
}

export interface ResponseData {
  status: number
  headers: { [key: string]: string }
  body: string
}
