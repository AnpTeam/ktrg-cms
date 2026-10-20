import { noticeList } from "../notices/notice-routes";

/** Every admin list, in menu order. A new table: its definition here, and its two route factories in createApp. */
export const ADMIN_LISTS = [noticeList] as const;
