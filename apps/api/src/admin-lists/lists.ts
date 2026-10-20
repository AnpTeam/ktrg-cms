import { auditLogList } from "../audit/audit-list";
import { bannerList } from "../banners/banner-list";
import { placeList } from "../content/place-list";
import { noticeList } from "../notices/notice-routes";
import { userList } from "../users/user-list";

/** Every admin list, in menu order. A new table: its definition here, and its two route factories in createApp. */
export const ADMIN_LISTS = [placeList, noticeList, bannerList, userList, auditLogList] as const;
