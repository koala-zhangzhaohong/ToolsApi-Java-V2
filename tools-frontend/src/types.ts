export type JsonRecord = Record<string, unknown>

export interface MediaData {
  preview_path?: string
  preview_path_hls?: string
  preview_path_flv?: string
  proxy_preview_path?: string[]
  download_path?: string
  proxy_download_path?: Array<Record<string, string>>
  [key: string]: unknown
}

export interface RankData {
  rank_list_url?: string
  rank_list_url_backup?: string
  rank_list_special?: string[]
  [key: string]: unknown
}

export interface DouyinResult extends JsonRecord {
  key?: string
  pro?: string
  code?: number
  message?: string
  desc?: string
  title?: string
  nickname?: string
  unique_id?: string
  room_id?: string
  song_id?: string
  user_id?: string
  sec_uid?: string
  media_data?: MediaData
  rank_data?: RankData
}

export interface PlayerPageData extends JsonRecord {
  title?: string
  path?: string
  proxyPath?: string
  data?: string[]
  multiVideoQualityInfo?: Record<string, string>
  proxyMultiVideoQualityInfoList?: Array<Record<string, string>>
  multiLiveQualityInfo?: Record<string, Record<string, string>>
  multiMvQualityInfo?: Record<string, string>
  musicInfo?: JsonRecord
  mvInfo?: Array<JsonRecord>
  authorName?: string
  artist?: string
  type?: string
  web_player_info?: JsonRecord
  item_info?: JsonRecord
  webPlayerInfo?: JsonRecord
  itemInfo?: JsonRecord
}
