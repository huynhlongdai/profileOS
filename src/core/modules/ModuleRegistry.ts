export interface ModuleMeta {
  name: string        // 'gmail'
  label: string       // 'Gmail Module'
  description: string
  version: string
  docsUrl?: string
}

export const BUILTIN_MODULES: ModuleMeta[] = [
  {
    name: "gmail",
    label: "Gmail Module",
    description: "Tự động check/login/care tài khoản Gmail sử dụng GPM profile + proxy.",
    version: "1.0.0",
  },
  {
    name: "coingecko_candy",
    label: "CoinGecko Candy",
    description: "Tự động claim daily Candy trên CoinGecko cho các tài khoản coingecko.",
    version: "1.0.0",
  },
  // sau này thêm:
  // {
  //   name: "outlook",
  //   label: "Outlook Module",
  //   description: "Tự động check/login/care Outlook.",
  //   version: "1.0.0",
  // },
]

