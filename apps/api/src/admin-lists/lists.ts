import { auditLogList } from "../audit/audit-list";
import { bannerList } from "../banners/banner-list";
import { authorList } from "../posts/author-list";
import { tagList } from "../posts/tag-list";
import { commentList } from "../posts/comments";
import { furiganaList } from "../furigana/furigana-words";
import { placeList } from "../content/place-list";
import { placeDirectoryList } from "../places/place-directory";
import { noticeList } from "../notices/notice-routes";
import { postList } from "../posts/post-list";
import { stampList } from "../stamps/stamp-list";
import { userList } from "../users/user-list";

/** Every admin list, in menu order. A new table: its definition here, and its two route factories in createApp. */
export const ADMIN_LISTS = [placeList, placeDirectoryList, noticeList, postList, authorList, tagList, commentList, bannerList, furiganaList, stampList, userList, auditLogList] as const;
