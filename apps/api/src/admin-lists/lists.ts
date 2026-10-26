import { auditLogList } from "../audit/audit-list";
import { bannerList } from "../banners/banner-list";
import { commentList } from "../posts/comments";
import { sitePageList } from "../pages/site-pages";
import { furiganaList } from "../furigana/furigana-words";
import { placeList } from "../content/place-list";
import { placeDirectoryList } from "../places/place-directory";
import { noticeList } from "../notices/notice-routes";
import { postList } from "../posts/post-list";
import { stampList } from "../stamps/stamp-list";
import { userList } from "../users/user-list";

/** Every admin list, in menu order. A new table: its definition here, and its two route factories in createApp. */
export const ADMIN_LISTS = [placeList, placeDirectoryList, noticeList, postList, commentList, bannerList, furiganaList, sitePageList, stampList, userList, auditLogList] as const;
