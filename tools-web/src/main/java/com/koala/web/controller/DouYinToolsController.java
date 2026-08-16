package com.koala.web.controller;

import com.koala.base.enums.DouYinRequestTypeEnums;
import com.koala.base.enums.DouYinTypeEnums;
import com.koala.data.models.abogus.AbogusDataModel;
import com.koala.data.models.douyin.live.TiktokLiveRankData;
import com.koala.data.models.douyin.live.TiktokMediaData;
import com.koala.data.models.douyin.live.TiktokSimpleData;
import com.koala.data.models.douyin.profile.TiktokUserProfileDataModel;
import com.koala.data.models.douyin.profile.TiktokUserInfoDataModel;
import com.koala.data.models.douyin.rank.*;
import com.koala.data.models.douyin.v1.PublicTiktokDataRespModel;
import com.koala.data.models.douyin.v1.itemInfo.ItemInfoRespModel;
import com.koala.data.models.douyin.v1.musicInfo.MusicInfoRespModel;
import com.koala.data.models.douyin.v1.roomInfoData.RoomInfoDataRespModel;
import com.koala.data.models.xbogus.XbogusDataModel;
import com.koala.factory.builder.ConcreteDouYinApiBuilder;
import com.koala.factory.builder.DouYinApiBuilder;
import com.koala.factory.director.DouYinApiManager;
import com.koala.factory.extra.tiktok.TiktokCookieUtil;
import com.koala.factory.extra.tiktok.XGorgonUtil;
import com.koala.factory.product.DouYinApiProduct;
import com.koala.service.custom.http.annotation.HttpRequestRecorder;
import com.koala.service.custom.http.annotation.MixedHttpRequest;
import com.koala.service.data.redis.service.RedisService;
import com.koala.service.threadPool.ThreadPoolUtil;
import com.koala.service.utils.*;
import com.koala.web.HostManager;
import com.koala.web.service.CdnResourceProxyService;
import com.koala.web.service.DistributedScheduledTaskExecutor;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.commons.collections4.IterableUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.web.DefaultRedirectStrategy;
import org.springframework.security.web.RedirectStrategy;
import org.springframework.util.ObjectUtils;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.spec.KeySpec;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.Callable;
import java.util.concurrent.Future;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

import static com.koala.base.enums.DouYinResponseEnums.*;
import static com.koala.base.enums.DouYinTypeEnums.*;
import static com.koala.factory.path.TiktokPathCollector.*;
import static com.koala.service.data.redis.RedisKeyPrefix.*;
import static com.koala.service.utils.RespUtil.formatRespData;

/**
 * @author koala
 * @version 1.0
 * @date 2022/2/19 15:33
 * @description
 */
@RestController
@RequestMapping("tools/DouYin")
public class DouYinToolsController {

    private static final Logger logger = LoggerFactory.getLogger(DouYinToolsController.class);

    private static final String LISTENER_ADMIN_PASSWORD_SALT = "toolsapi-masked-listener-admin-v1";
    private static final String LISTENER_ADMIN_PASSWORD_HASH = "e3e3f94de646ae7f2336b5809aedb2c9f3add52805741556157fa6c65a8574ad";
    private static final int LISTENER_ADMIN_PASSWORD_ITERATIONS = 210_000;

    private static final Integer MAX_RETRY_TIMES = 3;

    private static final String MASKED_USER_ID = "111111";

    private static final String TIKTOK_RANK_SNAPSHOT_PREFIX = "tiktok:rank:snapshot:";

    private static final String TIKTOK_RANK_CDN_SNAPSHOT_SUFFIX = ":cdn-users";

    private static final long TIKTOK_RANK_SNAPSHOT_EXPIRE_SECONDS = 5 * 60L;

    private final static Long EXPIRE_TIME = 3 * 24 * 60 * 60L;

    private final RedirectStrategy redirectStrategy = new DefaultRedirectStrategy();

    @Resource
    private HostManager hostManager;

    @Resource(name = "RedisService")
    private RedisService redisService;

    @Resource
    private TiktokCookieUtil tiktokCookieUtil;

    @Resource
    private CdnResourceProxyService cdnResourceProxyService;

    @Resource
    private DistributedScheduledTaskExecutor distributedScheduledTaskExecutor;

    @Value("${backend.server.cdn.address}")
    private String cdnServerAddress;

    @Value("${cdn.server.live.port}")
    private Integer cdnServerLivePort;

    @HttpRequestRecorder
    @GetMapping("player/video")
    public Object getVideo(@RequestParam(value = "vid", required = false) String vid, @RequestParam(value = "ratio", required = false, defaultValue = "540p") String ratio, @RequestParam(value = "isDownload", required = false, defaultValue = "0") String isDownload, HttpServletRequest request, HttpServletResponse response) throws IOException, URISyntaxException {
        if (ObjectUtils.isEmpty(vid)) {
            return formatRespData(FAILURE, null);
        }
        if (ObjectUtils.isEmpty(ratio) || Objects.equals(ratio, "default")) {
            ratio = "540p";
        }
        String link = "https://aweme.snssdk.com/aweme/v1/play/?video_id=" + vid + "&line=0&ratio=" + ratio + "&media_type=4&vr_type=0&improve_bitrate=0&is_play_url=1&is_support_h265=0&source=PackSourceEnum_PUBLISH";
        String redirectUrl = HttpClientUtil.doGetRedirectLocation(link, HeaderUtil.getDouYinDownloadHeader(), null);
        logger.info("[getVideo] inputUrl: {}, redirectUrl: {}", link, redirectUrl);
        if (ObjectUtils.isEmpty(redirectUrl)) {
            return formatRespData(FAILURE, null);
        }
        if ("0".equals(isDownload)) {
            redirectStrategy.sendRedirect(request, response, "/tools/DouYin/preview/video?path=" + Base64Utils.encodeToUrlSafeString(redirectUrl.getBytes(StandardCharsets.UTF_8)));
        } else {
            cdnResourceProxyService.redirect(response,
                    cdnResourceProxyService.downloadUrl(redirectUrl, null, vid, "mp4"));
        }
        return formatRespData(FAILURE, null);
    }

    @HttpRequestRecorder
    @GetMapping("preview/video")
    public void previewVideo(@RequestParam String path, @RequestParam(value = "isDownload", required = false, defaultValue = "false") Boolean isDownload, HttpServletRequest request, HttpServletResponse response) throws IOException, URISyntaxException {
        String url = new String(Base64Utils.decodeFromUrlSafeString(path));
        logger.info("[previewVideo] inputUrl: {}, Sec-Fetch-Dest: {}", url, request.getHeader("Sec-Fetch-Dest"));
        String cdnUrl = Boolean.TRUE.equals(isDownload)
                ? cdnResourceProxyService.downloadUrl(url, null, null, null)
                : cdnResourceProxyService.mediaUrl(url, null);
        cdnResourceProxyService.redirect(response, cdnUrl);
    }

    @HttpRequestRecorder
    @GetMapping("preview/liveStream")
    public void previewLiveStream(@RequestParam String path, HttpServletRequest request, HttpServletResponse response) throws IOException, URISyntaxException {
        String url = new String(Base64Utils.decodeFromUrlSafeString(path));
        logger.info("[previewLive] inputUrl: {}, Sec-Fetch-Dest: {}", url, request.getHeader("Sec-Fetch-Dest"));
        cdnResourceProxyService.redirect(response, url);
    }

    @HttpRequestRecorder
    @GetMapping("download/music")
    public void downloadMusic(@RequestParam String path, HttpServletRequest request, HttpServletResponse response) throws IOException, URISyntaxException {
        String url = new String(Base64Utils.decodeFromUrlSafeString(path));
        logger.info("[previewLive] inputUrl: {}, Sec-Fetch-Dest: {}", url, request.getHeader("Sec-Fetch-Dest"));
        cdnResourceProxyService.redirect(response,
                cdnResourceProxyService.downloadUrl(url, null, null, null));
    }

    @HttpRequestRecorder
    @GetMapping(value = "api", produces = {"application/json;charset=utf-8"})
    public Object getDouYinInfos(@MixedHttpRequest(required = false) String link, @RequestParam(value = "type", required = false, defaultValue = "info") String type, @RequestParam(value = "version", required = false, defaultValue = "4") Integer version, @RequestParam(value = "isMobile", required = false, defaultValue = "false") String isMobile, @RequestParam(value = "directJsonViewer", required = false, defaultValue = "false") Boolean directJsonViewer, HttpServletRequest request, HttpServletResponse response) throws IOException {
        if (ObjectUtils.isEmpty(link)) {
            return formatRespData(INVALID_LINK, null);
        }
        int typeId = DouYinRequestTypeEnums.getTypeIdByType(type);
        if (Objects.equals(typeId, DouYinRequestTypeEnums.INVALID_TYPE.getTypeId())) {
            return formatRespData(INVALID_TYPE, null);
        }
        String url;
        Optional<String> optional = Arrays.stream(link.split(" ")).filter(item -> item.contains("douyin.com/")).findFirst();
        if (optional.isPresent()) {
            url = optional.get().trim();
        } else {
            return formatRespData(INVALID_LINK, null);
        }
        PublicTiktokDataRespModel productData = null;
        Exception parseFailure = null;
        try {
            // 上游偶发返回空响应或不完整结构。每次使用全新的 builder，并以最终数据可生成为成功条件。
            Exception lastFailure = null;
            for (int attempt = 1; attempt <= 3 && productData == null; attempt++) {
                try {
                    DouYinApiBuilder builder = new ConcreteDouYinApiBuilder();
                    DouYinApiManager manager = new DouYinApiManager(builder);
                    DouYinApiProduct candidate = manager.construct(redisService, hostManager.getHost(), hostManager.getCdnHost(), url, version, isMobile, tiktokCookieUtil.getTiktokCookie());
                    PublicTiktokDataRespModel candidateData = candidate.generateData();
                    if (candidateData != null) {
                        productData = candidateData;
                    } else {
                        logger.warn("[DouYin] parse attempt {} returned empty data", attempt);
                    }
                } catch (Exception exception) {
                    lastFailure = exception;
                    if (attempt < 3) {
                        logger.warn("[DouYin] parse attempt {} failed, retrying: {}", attempt, exception.getMessage());
                    }
                }
            }
            if (productData == null && lastFailure != null) {
                throw lastFailure;
            }
        } catch (Exception e) {
            parseFailure = e;
            logger.error("[DouYin] parse failed for {}", url, e);
        }
        if (productData == null && Objects.equals(typeId, DouYinRequestTypeEnums.SIMPLE.getTypeId())) {
            String cachedData = redisService.get(JSON_KEY_PREFIX + ShortKeyGenerator.getKey(url));
            if (StringUtils.hasText(cachedData)) {
                TiktokSimpleData cachedSimpleData = GsonUtil.toBean(cachedData, TiktokSimpleData.class);
                if (cachedSimpleData != null) {
                    logger.warn("[DouYin] all realtime attempts failed for {}, returning the latest successful result", url);
                    return formatRespData(GET_DATA_SUCCESS, cachedSimpleData);
                }
            }
        }
        if (productData == null && parseFailure != null) {
            return formatRespData(FAILURE, null);
        }
        if (!Objects.isNull(productData)) {
            try {
                switch (Objects.requireNonNull(DouYinRequestTypeEnums.getEnumsByType(type))) {
                    case DOWNLOAD:
                        if (checkCanDownload(productData.getItemTypeId())) {
                            ItemInfoRespModel tmp = productData.getItemInfoData();
                            if (!Objects.isNull(tmp) && !Objects.isNull(tmp.getAwemeDetailModel()) && !Objects.isNull(tmp.getAwemeDetailModel().getVideo()) && !ObjectUtils.isEmpty(tmp.getAwemeDetailModel().getVideo().getMockDownloadVidPath())) {
                                redirectStrategy.sendRedirect(request, response, tmp.getAwemeDetailModel().getVideo().getMockDownloadVidPath());
                            }
                        } else {
                            return formatRespData(UNSUPPORTED_OPERATION, null);
                        }
                        break;
                    case PREVIEW:
                        if (checkCanPreview(productData.getItemTypeId())) {
                            DouYinTypeEnums douYinTypeEnum = DouYinTypeEnums.getEnumsByCode(productData.getItemTypeId());
                            switch (Objects.requireNonNull(douYinTypeEnum)) {
                                case MUSIC_TYPE -> {
                                    MusicInfoRespModel tmp = productData.getMusicItemInfoData();
                                    if (!Objects.isNull(tmp) && !Objects.isNull(tmp.getAwemeMusicDetail()) && !Objects.isNull(tmp.getAwemeMusicDetail().get(0)) && !Objects.isNull(tmp.getAwemeMusicDetail().get(0).getMusic()) && !ObjectUtils.isEmpty(tmp.getAwemeMusicDetail().get(0).getMusic().getMockPreviewMusicPath())) {
                                        redirectStrategy.sendRedirect(request, response, tmp.getAwemeMusicDetail().get(0).getMusic().getMockPreviewMusicPath());
                                    }
                                }
                                case VIDEO_TYPE -> {
                                    ItemInfoRespModel tmp = productData.getItemInfoData();
                                    if (!Objects.isNull(tmp) && !Objects.isNull(tmp.getAwemeDetailModel()) && !Objects.isNull(tmp.getAwemeDetailModel().getVideo()) && !ObjectUtils.isEmpty(tmp.getAwemeDetailModel().getVideo().getMockPreviewVidPath())) {
                                        redirectStrategy.sendRedirect(request, response, tmp.getAwemeDetailModel().getVideo().getMockPreviewVidPath());
                                    }
                                }
                                case LIVE_TYPE_1, LIVE_TYPE_2 -> {
                                    RoomInfoDataRespModel tmp = productData.getRoomItemInfoData();
                                    if (!Objects.isNull(tmp) && !Objects.isNull(tmp.getData()) && !Objects.isNull(tmp.getData().getData()) && !Objects.isNull(tmp.getData().getData().get(0)) && !Objects.isNull(tmp.getData().getData().get(0).getStreamUrl()) && StringUtils.hasLength(tmp.getData().getData().get(0).getStreamUrl().getMockPreviewLivePath())) {
                                        redirectStrategy.sendRedirect(request, response, tmp.getData().getData().get(0).getStreamUrl().getMockPreviewLivePath());
                                    }
                                }
                                case NOTE_TYPE -> {
                                    ItemInfoRespModel tmp = productData.getItemInfoData();
                                    if (!Objects.isNull(tmp) && !Objects.isNull(tmp.getAwemeDetailModel()) && !ObjectUtils.isEmpty(tmp.getAwemeDetailModel().getMockPreviewPicturePath())) {
                                        redirectStrategy.sendRedirect(request, response, tmp.getAwemeDetailModel().getMockPreviewPicturePath());
                                    }
                                }
                                default -> {
                                    return formatRespData(UNSUPPORTED_OPERATION, null);
                                }
                            }
                        } else {
                            return formatRespData(UNSUPPORTED_OPERATION, null);
                        }
                        break;
                    case INFO, INVALID_TYPE:
                        break;
                    case SIMPLE:
                        DouYinTypeEnums douYinTypeEnum = DouYinTypeEnums.getEnumsByCode(productData.getItemTypeId());
                        TiktokSimpleData simpleData = new TiktokSimpleData();
                        TiktokLiveRankData rankData = new TiktokLiveRankData();
                        TiktokMediaData mediaData = new TiktokMediaData();
                        switch (Objects.requireNonNull(douYinTypeEnum)) {
                            case MUSIC_TYPE -> {
                                var musicDetail = productData.getMusicItemInfoData().getAwemeMusicDetail().get(0);
                                var music = musicDetail.getMusic();
                                var author = musicDetail.getAuthor();
                                simpleData.setUserId(Objects.toString(musicDetail.getAuthorUserId(), null));
                                if (author != null) {
                                    simpleData.setSecUserId(author.getSecUid());
                                    simpleData.setNickname(author.getNickname());
                                    simpleData.setUid(author.getUid());
                                }
                                simpleData.setIdStr(music.getIdStr());
                                String songId = music.getSong() == null ? null : music.getSong().getIdStr();
                                simpleData.setSongId(StringUtils.hasText(songId) ? songId : music.getIdStr());
                                simpleData.setDesc(musicDetail.getDesc());
                                mediaData.setPreviewPath(music.getMockPreviewMusicPath());
                                mediaData.setDownloadPath(music.getMockDownloadMusicPath());
                            }
                            case VIDEO_TYPE -> {
                                simpleData.setUserId(productData.getItemInfoData().getAwemeDetailModel().getAuthorUserId().toString());
                                simpleData.setSecUserId(productData.getItemInfoData().getAwemeDetailModel().getAuthor().getSecUid());
                                simpleData.setNickname(productData.getItemInfoData().getAwemeDetailModel().getAuthor().getNickname());
                                simpleData.setSignature(productData.getItemInfoData().getAwemeDetailModel().getAuthor().getSignature());
                                simpleData.setShortId(productData.getItemInfoData().getAwemeDetailModel().getAuthor().getShortId());
                                simpleData.setUid(productData.getItemInfoData().getAwemeDetailModel().getAuthor().getUid());
                                simpleData.setUniqueId(productData.getItemInfoData().getAwemeDetailModel().getAuthor().getUniqueId());
                                simpleData.setDesc(productData.getItemInfoData().getAwemeDetailModel().getDesc());
                                mediaData.setPreviewPath(productData.getItemInfoData().getAwemeDetailModel().getVideo().getMockPreviewVidPath());
                                mediaData.setDownloadPath(productData.getItemInfoData().getAwemeDetailModel().getVideo().getMockDownloadVidPath());
                                mediaData.setProxyPreviewPath(productData.getItemInfoData().getAwemeDetailModel().getVideo().getMockPreviewProxyVidPathList());
                                mediaData.setProxyDownloadPath(productData.getItemInfoData().getAwemeDetailModel().getVideo().getMockDownloadProxyVidPathList());
                            }
                            case LIVE_TYPE_1, LIVE_TYPE_2 -> {
                                var owner = productData.getRoomItemInfoData().getData().getData().get(0).getOwner();
                                simpleData.setIdStr(owner.getIdStr());
                                simpleData.setSecUserId(owner.getSecUid());
                                simpleData.setNickname(owner.getNickname());
                                simpleData.setShortId(StringUtils.hasText(owner.getShortId()) ? owner.getShortId() : owner.getWebRid());
                                simpleData.setUniqueId(owner.getUniqueId());
                                simpleData.setRoomId(productData.getRoomItemInfoData().getData().getEnterRoomId());
                                simpleData.setTitle(productData.getRoomItemInfoData().getData().getData().get(0).getTitle());
                                rankData.setRankListUrl(productData.getRoomItemInfoData().getData().getData().get(0).getRankListData());
                                rankData.setRankListUrlBackup(productData.getRoomItemInfoData().getData().getData().get(0).getRankListDataBackup());
                                rankData.setRankListSpecial(buildRankListSpecial(rankData.getRankListUrlBackup(), productData.getRoomItemInfoData().getData().getData().get(0).getRankListDataSpecialLiat()));
                                mediaData.setPreviewPathHLS(productData.getRoomItemInfoData().getData().getData().get(0).getStreamUrl().getMockPreviewLivePath());
                                mediaData.setPreviewPathFLV(productData.getRoomItemInfoData().getData().getData().get(0).getStreamUrl().getMockPreviewLivePathBackup());
                            }
                            case NOTE_TYPE -> {
                                simpleData.setUserId(productData.getItemInfoData().getAwemeDetailModel().getAuthorUserId().toString());
                                simpleData.setSecUserId(productData.getItemInfoData().getAwemeDetailModel().getAuthor().getSecUid());
                                simpleData.setNickname(productData.getItemInfoData().getAwemeDetailModel().getAuthor().getNickname());
                                simpleData.setSignature(productData.getItemInfoData().getAwemeDetailModel().getAuthor().getSignature());
                                simpleData.setShortId(productData.getItemInfoData().getAwemeDetailModel().getAuthor().getShortId());
                                simpleData.setUid(productData.getItemInfoData().getAwemeDetailModel().getAuthor().getUid());
                                simpleData.setUniqueId(productData.getItemInfoData().getAwemeDetailModel().getAuthor().getUniqueId());
                                simpleData.setDesc(productData.getItemInfoData().getAwemeDetailModel().getDesc());
                                mediaData.setPreviewPath(productData.getItemInfoData().getAwemeDetailModel().getMockPreviewPicturePath());
                            }
                            default -> {
                            }
                        }
                        simpleData.setRankData(rankData);
                        simpleData.setMediaData(mediaData);
                        String key = ShortKeyGenerator.getKey(url);
                        String printerUrl = hostManager.getFrontendHost() + "tools/json/printer/pro?key=" + key + "&id=6";
                        simpleData.setPro(printerUrl);
                        redisService.set(JSON_KEY_PREFIX + key, GsonUtil.toString(simpleData), EXPIRE_TIME);
                        if (directJsonViewer) {
                            redirectStrategy.sendRedirect(request, response, printerUrl);
                        }
                        return formatRespData(GET_DATA_SUCCESS, simpleData);
                }
                return formatRespData(GET_DATA_SUCCESS, productData);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        if (directJsonViewer) {
            // 防止直接展示异常信息 转而展示500
            redirectStrategy.sendRedirect(request, response, hostManager.getFrontendHost() + "tools/json/printer/pro?id=3");
        }
        return formatRespData(GET_INFO_ERROR, null);
    }

    @HttpRequestRecorder
    @GetMapping(value = "api/feed/v1", produces = {"application/json;charset=utf-8"})
    public String getFeedV1() throws IOException, URISyntaxException {
        Map<String, String> params = new HashMap<>();
        params.put("cached_item_num", "0");
        params.put("device_type", "MI 5s");
        params.put("device_platform", "android");
        params.put("version_code", "290");
        params.put("app_name", "douyin_lite");
        params.put("os_version", "12.0.0");
        params.put("channel", "tengxun");
        String response = HttpClientUtil.doGet(TIKTOK_FEED_RECOMMEND_V1, HeaderUtil.getDouYinFeedSpecialHeader(), params);
        return formatRespData(GET_DATA_SUCCESS, GsonUtil.toBean(response, Object.class));
    }

    @SuppressWarnings("SpellCheckingInspection")
    @HttpRequestRecorder
    @GetMapping(value = "api/feed/recommend/v2", produces = {"application/json;charset=utf-8"})
    public String getRecommendFeedV2() throws IOException, URISyntaxException {
        Map<String, String> params = new HashMap<>();
        params.put("type", "0");
        params.put("max_cursor", "0");
        params.put("min_cursor", "0");
        params.put("count", "6");
        params.put("volume", "0.8666666666666667");
        params.put("pull_type", "2");
        params.put("need_relieve_aweme", "0");
        params.put("filter_warn", "0");
        params.put("req_from", "");
        params.put("is_cold_start", "0");
        params.put("iid", "84579705899");
        params.put("device_id", "69367187550");
        params.put("ac", "wifi");
        params.put("channel", "douyin_lite_gw");
        params.put("aid", "2329");
        params.put("app_name", "douyin_lite");
        params.put("version_code", "180");
        params.put("version_name", "1.8.0");
        params.put("device_platform", "android");
        params.put("ssmix", "a");
        params.put("device_type", "Redmi+Note+7+Pro");
        params.put("device_brand", "Xiaomi");
        params.put("language", "zh");
        params.put("os_api", "28");
        params.put("os_version", "9");
        params.put("openudid", "e4680b0d0446ad09");
        params.put("manifest_version_code", "180");
        params.put("resolution", "1080*2119");
        params.put("dpi", "440");
        params.put("_rticket", "");
        params.put("ts", "");
        params.put("js_sdk_version", "1.10.4");
        params.put("as", "a1iosdfgh");
        params.put("cp", "androide1");
        String response = XGorgonUtil.doGetRequest(TIKTOK_FEED_RECOMMEND_V2, params);
        return formatRespData(GET_DATA_SUCCESS, GsonUtil.toBean(response, Object.class));
    }

    @SuppressWarnings("SpellCheckingInspection")
    @HttpRequestRecorder
    @GetMapping(value = "api/feed/nearby/v2", produces = {"application/json;charset=utf-8"})
    public String getNearbyFeedV2() throws IOException, URISyntaxException {
        Map<String, String> params = new HashMap<>();
        params.put("feed_style", "1");
        params.put("max_cursor", "0");
        params.put("min_cursor", "0");
        params.put("count", "6");
        params.put("retry_type", "no_retry");
        params.put("iid", "84579705899");
        params.put("device_id", "69367187550");
        params.put("ac", "wifi");
        params.put("channel", "douyin_lite_gw");
        params.put("aid", "2329");
        params.put("app_name", "douyin_lite");
        params.put("version_code", "180");
        params.put("version_name", "1.8.0");
        params.put("device_platform", "android");
        params.put("ssmix", "a");
        params.put("device_type", "Redmi+Note+7+Pro");
        params.put("device_brand", "Xiaomi");
        params.put("language", "zh");
        params.put("os_api", "28");
        params.put("os_version", "9");
        params.put("openudid", "e4680b0d0446ad09");
        params.put("manifest_version_code", "180");
        params.put("resolution", "1080*2119");
        params.put("dpi", "440");
        params.put("update_version_code", "1800");
        params.put("_rticket", "");
        params.put("ts", "");
        params.put("js_sdk_version", "1.10.4");
        params.put("as", "a1iosdfgh");
        params.put("cp", "androide1");
        String response = XGorgonUtil.doGetRequest(TIKTOK_FEED_NEARBY_V2, params);
        return formatRespData(GET_DATA_SUCCESS, GsonUtil.toBean(response, Object.class));
    }

    @HttpRequestRecorder
    @GetMapping(value = "api/ranklist/audience", produces = {"application/json;charset=utf-8"})
    public String getRanklistAudience(@RequestParam String roomId, @RequestParam(required = false, defaultValue = "1") String version, @RequestParam(required = false, defaultValue = "0") String extra, @RequestParam(required = false) String nickname, @RequestParam(required = false, value = "config", defaultValue = "1") String config, @RequestParam(required = false, value = "offset", defaultValue = "0") Integer offset, @RequestParam(required = false, value = "count", defaultValue = "200") Integer count) throws IOException, URISyntaxException {
        if (ObjectUtils.isEmpty(roomId)) {
            return formatRespData(INVALID_PARAM, null);
        }
        String snapshotKey = getRankSnapshotKey(roomId, version, config, nickname);
        // extra=0 创建本次榜单快照；后续 extra=1 的每一个批次都从同一快照取数，
        // 避免上游榜单实时变动后导致前端按 sec_uid 合并时丢行。
        String response = "1".equals(extra) ? redisService.get(snapshotKey) : null;
        if (!StringUtils.hasText(response)) {
            String url = TIKTOK_RANKLIST_AUDIENCE + "?aid=6383&app_name=douyin_web&live_id=1&device_platform=web&language=zh-CN&enter_from=web_homepage_follow&cookie_enabled=true&screen_width=2304&screen_height=1296&browser_language=zh-CN&browser_platform=MacIntel&browser_name=Chrome&browser_version=147.0.0.0&os_name=Mac+OS&os_version=10.15.7&webcast_sdk_version=2450&room_id=" + roomId + "&rank_type=30";
            XbogusDataModel xbogusDataModel = XbogusUtil.encrypt(url);
            if (Objects.isNull(xbogusDataModel) || ObjectUtils.isEmpty(xbogusDataModel.getUrl())) {
                return formatRespData(ENCRYPT_URL_ERROR, null);
            }
            response = HttpClientUtil.doGetWithoutTimeout(xbogusDataModel.getUrl(), HeaderUtil.getDouYinSpecialHeader(xbogusDataModel.getMstoken(), xbogusDataModel.getTtwid(), tiktokCookieUtil.getTiktokCookie(), true), null);
            if (StringUtils.hasText(response)) {
                redisService.set(snapshotKey, response, TIKTOK_RANK_SNAPSHOT_EXPIRE_SECONDS);
            }
        }
        if (StringUtils.hasLength(response)) {
            switch (version) {
                case "1" -> {
                    return formatRespData(GET_DATA_SUCCESS, GsonUtil.toBean(response, Object.class));
                }
                case "2" -> {
                    TiktokLiveRankDataRespModel originResponseData = GsonUtil.toBean(response, TiktokLiveRankDataRespModel.class);
                    TiktokLiveRankResponseDataModel responseData = new TiktokLiveRankResponseDataModel();
                    responseData.setRoomId(roomId);
                    ArrayList<TiktokLiveRankUserInfoModel> rawUserInfoList = new ArrayList<>();
                    IterableUtils.forEach(originResponseData.getData().getRanks(), item -> {
                        TiktokLiveRankUserInfoModel userInfoModel = new TiktokLiveRankUserInfoModel();
                        BeanUtils.copyProperties(item.getUser(), userInfoModel);
                        userInfoModel.setUserInfoDirection(hostManager.getHost() + "tools/DouYin/api/user/profile/other?secUserId=" + userInfoModel.getSecUid() + "&config=2");
                        rawUserInfoList.add(userInfoModel);
                    });
                    appendCdnRankUsers(rawUserInfoList, getCdnRankUsers(roomId, snapshotKey, extra));
                    ArrayList<TiktokLiveRankUserInfoModel> userInfoList = deduplicateRankUsers(rawUserInfoList);
                    ArrayList<TiktokLiveRankUserInfoModel> userInfoDataList;
                    switch (config) {
                        case "1" -> {
                            userInfoDataList = new ArrayList<>(userInfoList);
                        }
                        case "2" -> {
                            userInfoDataList = getDataListByPrefix(userInfoList, ObjectUtils.isEmpty(nickname) ? "" : nickname);
                        }
                        default -> {
                            return formatRespData(INVALID_CONFIG, null);
                        }
                    }
                    // 普通榜单的 nickname 就是可直接展示的昵称，不需要逐个请求资料接口。
                    // 只有“神秘人”等特殊昵称筛选入口才需要反查真实昵称。
                    if ("1".equals(extra)) {
                        userInfoDataList = doMultiThreadRealNickNameExecuter(userInfoDataList, offset, count);
                    }
                    responseData.setUserList(userInfoDataList);
                    return formatRespData(GET_DATA_SUCCESS, GsonUtil.toBean(GsonUtil.toString(responseData), Object.class));
                }
                case "3" -> {
                    TiktokLiveRankDataRespModel originResponseData = GsonUtil.toBean(response, TiktokLiveRankDataRespModel.class);
                    TiktokLiveRankSimpleResponseDataModel responseData = new TiktokLiveRankSimpleResponseDataModel();
                    responseData.setRoomId(roomId);
                    ArrayList<TiktokLiveRankSimpleUserInfoModel> rawUserInfoList = new ArrayList<>();
                    IterableUtils.forEach(originResponseData.getData().getRanks(), item -> {
                        TiktokLiveRankSimpleUserInfoModel simpleUserInfoModel = new TiktokLiveRankSimpleUserInfoModel();
                        BeanUtils.copyProperties(item.getUser(), simpleUserInfoModel);
                        simpleUserInfoModel.setUserInfoDirection(hostManager.getHost() + "tools/DouYin/api/user/profile/other?secUserId=" + simpleUserInfoModel.getSecUid() + "&config=2");
                        rawUserInfoList.add(simpleUserInfoModel);
                    });
                    appendCdnSimpleRankUsers(rawUserInfoList, getCdnRankUsers(roomId, snapshotKey, extra));
                    ArrayList<TiktokLiveRankSimpleUserInfoModel> userInfoList = deduplicateSimpleRankUsers(rawUserInfoList);
                    ArrayList<TiktokLiveRankSimpleUserInfoModel> userInfoDataList;
                    switch (config) {
                        case "1" -> {
                            userInfoDataList = new ArrayList<>(userInfoList);
                        }
                        case "2" -> {
                            userInfoDataList = getSimpleDataListByPrefix(userInfoList, ObjectUtils.isEmpty(nickname) ? "" : nickname);
                        }
                        default -> {
                            return formatRespData(INVALID_CONFIG, null);
                        }
                    }
                    // 普通榜单的 nickname 就是可直接展示的昵称，不需要逐个请求资料接口。
                    // 只有“神秘人”等特殊昵称筛选入口才需要反查真实昵称。
                    if ("1".equals(extra)) {
                        userInfoDataList = doMultiThreadRealNickNameExecuter(userInfoDataList, offset, count);
                    }
                    responseData.setUserList(userInfoDataList);
                    return formatRespData(GET_DATA_SUCCESS, GsonUtil.toBean(GsonUtil.toString(responseData), Object.class));
                }
            }
        }
        return formatRespData(GET_INFO_ERROR, null);
    }

    @HttpRequestRecorder
    @GetMapping(value = "api/user/profile/other", produces = {"application/json;charset=utf-8"})
    public String getUserProfileOther(@RequestParam String secUserId, @RequestParam(defaultValue = "2", required = false) String config) throws IOException, URISyntaxException {
        if (ObjectUtils.isEmpty(secUserId)) {
            return formatRespData(INVALID_PARAM, null);
        }
        String url = TIKTOK_USER_PROFILE_OTHER + "?device_platform=webapp&aid=6383&channel=channel_pc_web&publish_video_strategy_type=2&source=channel_pc_web&sec_user_id=" + secUserId + "&version_code=160100&version_name=16.1.0&_signature=_02B4Z6wo00d01A8CVfgAAIDB2MR4gyyTjxgPAlFAAGMe23";
        AbogusDataModel abogusDataModel = AbogusUtil.encrypt(url);
        if (Objects.isNull(abogusDataModel) || ObjectUtils.isEmpty(abogusDataModel.getUrl())) {
            return formatRespData(ENCRYPT_URL_ERROR, null);
        }
        String response = HttpClientUtil.doGetWithoutTimeout(abogusDataModel.getUrl(), HeaderUtil.getDouYinSpecialHeader(abogusDataModel.getMstoken(), abogusDataModel.getTtwid(), tiktokCookieUtil.getTiktokCookie(), true), null);
        if (StringUtils.hasLength(response)) {
            switch (config) {
                case "1" -> {
                    return formatRespData(GET_DATA_SUCCESS, GsonUtil.toBean(response, Object.class));
                }
                case "2" -> {
                    return formatRespData(GET_DATA_SUCCESS, GsonUtil.toBean(response, TiktokUserProfileDataModel.class));
                }
                default -> {
                    return formatRespData(INVALID_CONFIG, null);
                }
            }
        }
        return formatRespData(GET_INFO_ERROR, null);
    }

    @GetMapping(value = "api/ranklist/audience/nickname/retry", produces = {"application/json;charset=utf-8"})
    public String retrySpecialRankNickname(@RequestParam String nickname) throws IOException, URISyntaxException {
        if (!StringUtils.hasText(nickname) || !nickname.trim().matches("^(神秘人|神秘嘉宾|dou)\\d+$")) {
            return formatRespData(INVALID_PARAM, null);
        }
        Map<String, Object> resolved = getSpecialRankNicknameFromCdn(nickname.trim());
        if (resolved.isEmpty()) {
            return formatRespData(GET_INFO_ERROR, null);
        }
        return formatRespData(GET_DATA_SUCCESS, resolved);
    }

    @GetMapping(value = "api/ranklist/audience/gift-records", produces = {"application/json;charset=utf-8"})
    public String getSpecialRankGiftRecords(@RequestParam String roomId,
                                            @RequestParam String nickname,
                                            @RequestParam(required = false) String account,
                                            @RequestParam(required = false) String secUserId) throws IOException, URISyntaxException {
        if (!StringUtils.hasText(roomId) || !StringUtils.hasText(nickname) || !isSpecialRankNickname(nickname)) {
            return formatRespData(INVALID_PARAM, null);
        }
        Map<String, Object> cachedUser = getSpecialRankUserFromCdn(nickname.trim());
        if (cachedUser.isEmpty()) {
            String type = nickname.trim().startsWith("神秘嘉宾") ? "mystery-guest"
                    : nickname.trim().startsWith("dou") ? "dou" : "mystery-person";
            HttpClientUtil.HttpResult result = HttpClientUtil.getResponseWithoutTimeout(
                    liveCdnUrl("/api/douyin/live/users/" + URLEncoder.encode(roomId.trim(), StandardCharsets.UTF_8) + '/' + type),
                    Map.of("Accept", "application/json"), null);
            if (result.isSuccessful() && StringUtils.hasText(result.body())) {
                Map<String, Object> nicknameFallback = Collections.emptyMap();
                List<Map<String, Object>> candidates = GsonUtil.toListMaps(result.body());
                for (Map<String, Object> candidate : candidates == null ? Collections.<Map<String, Object>>emptyList() : candidates) {
                    String candidateSecUid = Objects.toString(candidate.get("sec_uid"), "");
                    String candidateAccount = cdnUserAccount(candidate);
                    String candidateNickname = Objects.toString(candidate.get("nickname"), "");
                    if ((StringUtils.hasText(secUserId) && secUserId.trim().equals(candidateSecUid))
                            || (StringUtils.hasText(account) && account.trim().equals(candidateAccount))) {
                        cachedUser = candidate;
                        break;
                    }
                    if (nicknameFallback.isEmpty() && nickname.trim().equals(candidateNickname)) {
                        nicknameFallback = candidate;
                    }
                }
                if (cachedUser.isEmpty()) cachedUser = nicknameFallback;
            }
        }
        Object extra = cachedUser.containsKey("extra") ? cachedUser.get("extra") : cachedUser.get("extra_info");
        return formatRespData(GET_DATA_SUCCESS, Map.of(
                "extra", extra instanceof Collection<?> ? extra : Collections.emptyList()));
    }

    @GetMapping(value = "api/ranklist/audience/listener/status", produces = {"application/json;charset=utf-8"})
    public String getRankAudienceListenerStatus(@RequestParam(required = false) String secUserId,
                                                @RequestParam(required = false) String key,
                                                @RequestParam(required = false) String liveId) throws IOException, URISyntaxException {
        TiktokSimpleData cachedLive = getLiveDataByKey(key);
        String resolvedLiveId = StringUtils.hasText(liveId) ? liveId.trim() : liveIdFromSimpleData(cachedLive);
        String resolvedSecUserId = StringUtils.hasText(secUserId) ? secUserId.trim()
                : cachedLive == null ? null : cachedLive.getSecUserId();
        if (!StringUtils.hasText(resolvedLiveId) && !StringUtils.hasText(resolvedSecUserId)) {
            return formatRespData(INVALID_PARAM, null);
        }
        if (!StringUtils.hasText(resolvedLiveId)) resolvedLiveId = getLiveShortId(resolvedSecUserId);
        if (!StringUtils.hasText(resolvedLiveId)) {
            return formatRespData(GET_INFO_ERROR, null);
        }
        HttpClientUtil.HttpResult listenerResponse = HttpClientUtil.getResponse(
                liveCdnUrl("/api/douyin/live/" + URLEncoder.encode(resolvedLiveId, StandardCharsets.UTF_8)),
                Map.of("Accept", "application/json"), null);
        if (!listenerResponse.isSuccessful() && listenerResponse.statusCode() != 404) {
            logger.warn("[getRankAudienceListenerStatus] live CDN returned status: {}, liveId: {}",
                    listenerResponse.statusCode(), resolvedLiveId);
            return formatRespData(GET_INFO_ERROR, null);
        }
        Map<String, Object> result = new HashMap<>();
        result.put("liveId", resolvedLiveId);
        result.put("listening", listenerResponse.isSuccessful());
        return formatRespData(GET_DATA_SUCCESS, result);
    }

    @PostMapping(value = "api/ranklist/audience/listener/start", produces = {"application/json;charset=utf-8"})
    public String startRankAudienceListener(@RequestParam String liveId) throws IOException, URISyntaxException {
        if (!StringUtils.hasText(liveId)) {
            return formatRespData(INVALID_PARAM, null);
        }
        String normalizedLiveId = liveId.trim();
        HttpClientUtil.HttpResult current = HttpClientUtil.getResponseWithoutTimeout(
                liveCdnUrl("/api/douyin/live/" + URLEncoder.encode(normalizedLiveId, StandardCharsets.UTF_8)),
                Map.of("Accept", "application/json"), null);
        if (current.isSuccessful()) {
            return formatRespData(GET_DATA_SUCCESS, Map.of("liveId", normalizedLiveId, "listening", true));
        }
        if (current.statusCode() != 404) {
            return formatRespData(GET_INFO_ERROR, null);
        }
        HttpClientUtil.HttpResult started = HttpClientUtil.postJsonResponse(
                liveCdnUrl("/api/douyin/live/start"),
                Map.of("Accept", "application/json", "Content-Type", "application/json"),
                GsonUtil.toString(Map.of("liveId", normalizedLiveId)));
        if (!started.isSuccessful()) {
            logger.warn("[startRankAudienceListener] live CDN returned status: {}, liveId: {}",
                    started.statusCode(), normalizedLiveId);
            return formatRespData(GET_INFO_ERROR, null);
        }
        Map<String, Object> result = new HashMap<>();
        result.put("liveId", normalizedLiveId);
        result.put("listening", true);
        if (StringUtils.hasText(started.body())) {
            result.put("listener", GsonUtil.toBean(started.body(), Object.class));
        }
        return formatRespData(GET_DATA_SUCCESS, result);
    }

    @PostMapping(value = "api/ranklist/audience/listener/stop", produces = {"application/json;charset=utf-8"})
    public String stopRankAudienceListener(@RequestParam String liveId,
                                           @RequestBody(required = false) Map<String, String> request) throws IOException, URISyntaxException {
        if (!StringUtils.hasText(liveId)) {
            return formatRespData(INVALID_PARAM, null);
        }
        String password = request == null ? null : request.get("password");
        if (!verifyListenerAdminPassword(password)) {
            return RespUtil.formatRespDataWithCustomMsg(403, "密码错误", null);
        }
        String normalizedLiveId = liveId.trim();
        HttpClientUtil.HttpResult stopped = HttpClientUtil.deleteResponse(
                liveCdnUrl("/api/douyin/live/" + URLEncoder.encode(normalizedLiveId, StandardCharsets.UTF_8)),
                Map.of("Accept", "application/json"), null);
        if (!stopped.isSuccessful() && stopped.statusCode() != 404) {
            logger.warn("[stopRankAudienceListener] live CDN returned status: {}, liveId: {}",
                    stopped.statusCode(), normalizedLiveId);
            return formatRespData(GET_INFO_ERROR, null);
        }
        return formatRespData(GET_DATA_SUCCESS, Map.of("liveId", normalizedLiveId, "listening", false));
    }

    private boolean verifyListenerAdminPassword(String password) {
        if (!StringUtils.hasText(password)) return false;
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(),
                LISTENER_ADMIN_PASSWORD_SALT.getBytes(StandardCharsets.UTF_8),
                LISTENER_ADMIN_PASSWORD_ITERATIONS, 256);
        try {
            byte[] actual = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
            byte[] expected = HexFormat.of().parseHex(LISTENER_ADMIN_PASSWORD_HASH);
            return MessageDigest.isEqual(actual, expected);
        } catch (Exception exception) {
            logger.error("[verifyListenerAdminPassword] failed to verify password", exception);
            return false;
        } finally {
            spec.clearPassword();
        }
    }

    @HttpRequestRecorder
    @GetMapping("set/ttwid")
    public String setToken(@RequestParam(required = false) String ttwid) {
        redisService.set(TIKTOK_TTWID_DATA, ttwid);
        return redisService.getAndPersist(TIKTOK_TTWID_DATA);
    }

    @HttpRequestRecorder
    @GetMapping("reset/cookie")
    public void resetCookie(@RequestParam(required = false) String lock) {
        redisService.set(TIKTOK_COOKIE_LOCK, lock, 14 * 24 * 60 * 60L);
    }

    @HttpRequestRecorder
    @GetMapping("current/cookie")
    public String getCookie() {
        return redisService.get(TIKTOK_COOKIE_DATA);
    }

    @HttpRequestRecorder
    @GetMapping("refresh/cookie")
    public String refreshCookie() {
        tiktokCookieUtil.doRefreshTiktokCookieTask();
        return redisService.get(TIKTOK_COOKIE_DATA);
    }

    @Scheduled(cron = "0 0 12 * * ?")
    public void refreshToken() {
        distributedScheduledTaskExecutor.runOnce(
                "tiktok-token-refresh",
                Duration.ofHours(1),
                tiktokCookieUtil::doRefreshTiktokCookieTask
        );
    }

    private Boolean checkCanDownload(Integer itemTypeId) {
        return itemTypeId.equals(VIDEO_TYPE.getCode());
    }

    private Boolean checkCanPreview(Integer itemTypeId) {
        return itemTypeId.equals(VIDEO_TYPE.getCode()) || itemTypeId.equals(LIVE_TYPE_1.getCode()) || itemTypeId.equals(LIVE_TYPE_2.getCode()) || itemTypeId.equals(MUSIC_TYPE.getCode());
    }

    private String getRealNickName(String secUserId) throws IOException, URISyntaxException {
        String tmp = redisService.get(TIKTOK_PROFILE_INFO + secUserId);
        if (StringUtils.hasLength(tmp)) {
            TiktokUserProfileDataModel tmpData = GsonUtil.toBean(tmp, TiktokUserProfileDataModel.class);
            if (tmpData != null && tmpData.getUser() != null && StringUtils.hasText(tmpData.getUser().getNickname())) {
                return tmpData.getUser().getNickname();
            }
        }
        String url = TIKTOK_USER_PROFILE_OTHER + "?device_platform=webapp&aid=6383&channel=channel_pc_web&publish_video_strategy_type=2&source=channel_pc_web&sec_user_id=" + secUserId + "&version_code=160100&version_name=16.1.0&_signature=_02B4Z6wo00d01A8CVfgAAIDB2MR4gyyTjxgPAlFAAGMe23";
        AbogusDataModel abogusDataModel = AbogusUtil.encrypt(url);
        if (Objects.isNull(abogusDataModel) || ObjectUtils.isEmpty(abogusDataModel.getUrl())) {
            return null;
        }
        String response;
        for (int retry = 0; retry < MAX_RETRY_TIMES; retry++) {
            response = HttpClientUtil.doGetWithoutTimeout(abogusDataModel.getUrl(), HeaderUtil.getDouYinSpecialHeader(abogusDataModel.getMstoken(), abogusDataModel.getTtwid(), tiktokCookieUtil.getTiktokCookie(), true), null);
            if (StringUtils.hasLength(response)) {
                TiktokUserProfileDataModel profileData = GsonUtil.toBean(response, TiktokUserProfileDataModel.class);
                String nickname = profileData != null && profileData.getUser() != null ? profileData.getUser().getNickname() : null;
                if (StringUtils.hasText(nickname)) {
                    redisService.set(TIKTOK_PROFILE_INFO + secUserId, response, 30 * 60L);
                    return nickname;
                }
            }
            logger.info("[getRealNickName] no valid nickname for secUserId: {}, retry: {}", secUserId, retry + 1);
        }
        return null;
    }

    private String getLiveShortId(String secUserId) throws IOException, URISyntaxException {
        String cached = redisService.get(TIKTOK_PROFILE_INFO + secUserId);
        if (StringUtils.hasText(cached)) {
            TiktokUserProfileDataModel profile = GsonUtil.toBean(cached, TiktokUserProfileDataModel.class);
            String shortId = profileShortId(profile);
            if (StringUtils.hasText(shortId)) {
                return shortId;
            }
        }
        String url = TIKTOK_USER_PROFILE_OTHER + "?device_platform=webapp&aid=6383&channel=channel_pc_web&publish_video_strategy_type=2&source=channel_pc_web&sec_user_id=" + secUserId + "&version_code=160100&version_name=16.1.0&_signature=_02B4Z6wo00d01A8CVfgAAIDB2MR4gyyTjxgPAlFAAGMe23";
        AbogusDataModel abogusDataModel = AbogusUtil.encrypt(url);
        if (Objects.isNull(abogusDataModel) || !StringUtils.hasText(abogusDataModel.getUrl())) {
            return null;
        }
        HttpClientUtil.HttpResult profileResponse = HttpClientUtil.getResponseQuick(abogusDataModel.getUrl(),
                HeaderUtil.getDouYinSpecialHeader(abogusDataModel.getMstoken(), abogusDataModel.getTtwid(),
                        tiktokCookieUtil.getTiktokCookie(), true), null);
        if (profileResponse.isSuccessful() && StringUtils.hasText(profileResponse.body())) {
            TiktokUserProfileDataModel profile = GsonUtil.toBean(profileResponse.body(), TiktokUserProfileDataModel.class);
            String shortId = profileShortId(profile);
            if (StringUtils.hasText(shortId)) {
                redisService.set(TIKTOK_PROFILE_INFO + secUserId, profileResponse.body(), 30 * 60L);
                return shortId;
            }
        }
        logger.info("[getLiveShortId] no valid short_id for secUserId: {}", secUserId);
        return null;
    }

    private TiktokSimpleData getLiveDataByKey(String key) {
        if (!StringUtils.hasText(key)) return null;
        String cached = redisService.get(JSON_KEY_PREFIX + key.trim());
        if (!StringUtils.hasText(cached)) return null;
        return GsonUtil.toBean(cached, TiktokSimpleData.class);
    }

    private String liveIdFromSimpleData(TiktokSimpleData data) {
        if (data == null) return null;
        if (StringUtils.hasText(data.getShortId()) && !"0".equals(data.getShortId())) return data.getShortId();
        return StringUtils.hasText(data.getUniqueId()) ? data.getUniqueId() : null;
    }

    private String profileShortId(TiktokUserProfileDataModel profile) {
        TiktokUserInfoDataModel user = profile == null ? null : profile.getUser();
        if (user == null) return null;
        if (StringUtils.hasText(user.getShortId()) && !"0".equals(user.getShortId())) {
            return user.getShortId();
        }
        // 部分直播主播的用户资料不会返回 short_id；监听服务同样接受公开 unique_id。
        return StringUtils.hasText(user.getUniqueId()) ? user.getUniqueId() : null;
    }

    private String liveCdnUrl(String path) {
        return "http://" + cdnServerAddress + ':' + cdnServerLivePort + path;
    }

    private List<Map<String, Object>> getCdnRankUsers(String roomId, String snapshotKey, String extra) {
        String cacheKey = snapshotKey + TIKTOK_RANK_CDN_SNAPSHOT_SUFFIX;
        if ("1".equals(extra)) {
            String cached = redisService.get(cacheKey);
            if (StringUtils.hasText(cached)) return GsonUtil.toListMaps(cached);
        }
        List<Map<String, Object>> users = new ArrayList<>();
        for (String type : List.of("mystery-person", "mystery-guest", "dou")) {
            try {
                HttpClientUtil.HttpResult result = HttpClientUtil.getResponseWithoutTimeout(
                        liveCdnUrl("/api/douyin/live/users/" + URLEncoder.encode(roomId, StandardCharsets.UTF_8) + '/' + type),
                        Map.of("Accept", "application/json"), null);
                if (result.isSuccessful() && StringUtils.hasText(result.body())) {
                    List<Map<String, Object>> typeUsers = GsonUtil.toListMaps(result.body());
                    if (typeUsers != null) users.addAll(typeUsers);
                }
            } catch (Exception exception) {
                logger.info("[getCdnRankUsers] failed to load type: {}, roomId: {}, error: {}",
                        type, roomId, exception.getMessage());
            }
        }
        redisService.set(cacheKey, GsonUtil.toString(users), TIKTOK_RANK_SNAPSHOT_EXPIRE_SECONDS);
        return users;
    }

    private void appendCdnRankUsers(List<TiktokLiveRankUserInfoModel> target, List<Map<String, Object>> cdnUsers) {
        for (Map<String, Object> cached : cdnUsers) {
            TiktokLiveRankUserInfoModel user = new TiktokLiveRankUserInfoModel();
            fillCdnRankUser(cached, user, null);
            target.add(user);
        }
    }

    private void appendCdnSimpleRankUsers(List<TiktokLiveRankSimpleUserInfoModel> target, List<Map<String, Object>> cdnUsers) {
        for (Map<String, Object> cached : cdnUsers) {
            TiktokLiveRankSimpleUserInfoModel user = new TiktokLiveRankSimpleUserInfoModel();
            fillCdnRankUser(cached, null, user);
            target.add(user);
        }
    }

    private void fillCdnRankUser(Map<String, Object> cached, TiktokLiveRankUserInfoModel full,
                                 TiktokLiveRankSimpleUserInfoModel simple) {
        Long id = longValue(cached.get("id"));
        Long shortId = longValue(cached.get("short_id"));
        String nickname = Objects.toString(cached.get("nickname"), "");
        String secUid = Objects.toString(cached.get("sec_uid"), "");
        String account = shortId != null && shortId > 0 ? String.valueOf(shortId)
                : id != null && id > 0 ? String.valueOf(id) : secUid;
        Object extraInfo = cached.get("extra_info");
        String direction = StringUtils.hasText(secUid)
                ? hostManager.getHost() + "tools/DouYin/api/user/profile/other?secUserId=" + secUid + "&config=2" : null;
        if (full != null) {
            full.setId(id);
            full.setShortId(shortId);
            full.setNickname(nickname);
            full.setDisplayId(account);
            full.setSecUid(secUid);
            full.setUserInfoDirection(direction);
            full.setExtra(extraInfo instanceof Collection<?> ? extraInfo : Collections.emptyList());
            full.setCdnResolved(true);
        }
        if (simple != null) {
            simple.setId(id);
            simple.setShortId(shortId);
            simple.setNickname(nickname);
            simple.setDisplayId(account);
            simple.setSecUid(secUid);
            simple.setUserInfoDirection(direction);
            simple.setExtra(extraInfo instanceof Collection<?> ? extraInfo : Collections.emptyList());
            simple.setCdnResolved(true);
        }
    }

    private Long longValue(Object value) {
        if (value instanceof Number number) return number.longValue();
        try {
            return StringUtils.hasText(Objects.toString(value, "")) ? Long.parseLong(value.toString()) : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private ArrayList<TiktokLiveRankUserInfoModel> deduplicateRankUsers(List<TiktokLiveRankUserInfoModel> users) {
        LinkedHashMap<String, TiktokLiveRankUserInfoModel> unique = new LinkedHashMap<>();
        for (TiktokLiveRankUserInfoModel user : users) unique.put(rankAccountKey(
                user.getDisplayId(), user.getShortId(), user.getId(), user.getSecUid()), user);
        return new ArrayList<>(unique.values());
    }

    private ArrayList<TiktokLiveRankSimpleUserInfoModel> deduplicateSimpleRankUsers(List<TiktokLiveRankSimpleUserInfoModel> users) {
        LinkedHashMap<String, TiktokLiveRankSimpleUserInfoModel> unique = new LinkedHashMap<>();
        for (TiktokLiveRankSimpleUserInfoModel user : users) unique.put(rankAccountKey(
                user.getDisplayId(), user.getShortId(), user.getId(), user.getSecUid()), user);
        return new ArrayList<>(unique.values());
    }

    private String rankAccountKey(String displayId, Long shortId, Long id, String secUid) {
        if (StringUtils.hasText(displayId)) return "display:" + displayId.trim();
        if (shortId != null && shortId > 0) return "short:" + shortId;
        if (id != null && id > 0) return "id:" + id;
        if (StringUtils.hasText(secUid)) return "sec:" + secUid.trim();
        return "empty:" + UUID.randomUUID();
    }


    private <T> ArrayList<T> doMultiThreadRealNickNameExecuter(ArrayList<T> userInfoList, Integer offset, Integer count) {
        // 只补全当前展示批次的真实昵称；特殊入口筛选仍只匹配榜单返回的 nickname。
        int resolveOffset = offset == null ? 0 : Math.max(0, Math.min(offset, userInfoList.size()));
        int resolveCount = count == null || count < 0 ? userInfoList.size() - resolveOffset : Math.min(count, userInfoList.size() - resolveOffset);
        ArrayList<T> candidates = new ArrayList<>(userInfoList.subList(resolveOffset, resolveOffset + resolveCount));
        // 批次接口只返回需要反查的特殊用户；普通用户由前端直接使用榜单昵称兜底，
        // 无需重复传输或参与合并。
        ArrayList<T> specialCandidates = new ArrayList<>();
        for (T item : candidates) {
            if (isSpecialRankUser(item)) {
                specialCandidates.add(item);
            }
        }
        ThreadPoolUtil<HashMap<String, String>> threadPoolUtil = ThreadPoolUtil.getInstance();
        List<Future<HashMap<String, String>>> futureList = new ArrayList<>();
        // 每个用户一个 I/O 任务，交由共享线程池动态扩容；同时去重，避免重复请求。
        Set<String> submittedUsers = new HashSet<>();
        for (T item : specialCandidates) {
            String secUid = getSecUid(item);
            String nickname = getRankNickname(item);
            boolean masked = isMaskedUser(item);
            String requestKey = masked ? "masked:" + nickname : "sec:" + secUid;
            if (isSpecialRankUser(item) && StringUtils.hasText(secUid) && submittedUsers.add(requestKey)) {
                Callable<HashMap<String, String>> task = masked
                        ? () -> executeMaskedRankNickname(item)
                        : () -> execute(Collections.singletonList(item));
                Future<HashMap<String, String>> future = threadPoolUtil.submitTask(task);
                futureList.add(future);
            }
        }
        HashMap<String, String> nicknameInfoMap = new HashMap<>();
        IterableUtils.forEach(futureList, future -> {
            try {
                nicknameInfoMap.putAll(future.get());
            } catch (Exception e) {
                logger.error("[doMultiThreadRealNickNameExecuter] on solved error: {}", e.getMessage());
                e.printStackTrace();
            }
        });
        IterableUtils.forEach(specialCandidates, item -> {
            if (item instanceof TiktokLiveRankUserInfoModel) {
                TiktokLiveRankUserInfoModel user = (TiktokLiveRankUserInfoModel) item;
                String realNickname = nicknameInfoMap.get(user.getSecUid());
                // 某些榜单记录已带有原始昵称；反查失败不能把这个可用结果清空，
                // 否则前端会把该条误判为失败并展示“重试”。
                if (StringUtils.hasText(realNickname)) {
                    user.setUserRealNickName(realNickname);
                }
            }
            if (item instanceof TiktokLiveRankSimpleUserInfoModel) {
                TiktokLiveRankSimpleUserInfoModel user = (TiktokLiveRankSimpleUserInfoModel) item;
                String realNickname = nicknameInfoMap.get(user.getSecUid());
                if (StringUtils.hasText(realNickname)) {
                    user.setUserRealNickName(realNickname);
                }
            }
        });
        return specialCandidates;
    }

    private boolean isSpecialRankUser(Object userInfo) {
        String nickname = null;
        if (userInfo instanceof TiktokLiveRankUserInfoModel user) nickname = user.getNickname();
        if (userInfo instanceof TiktokLiveRankSimpleUserInfoModel user) nickname = user.getNickname();
        if (!StringUtils.hasText(nickname)) return false;
        String value = nickname.trim();
        return value.startsWith("神秘人") || value.startsWith("dou") || value.startsWith("神秘嘉宾");
    }

    private boolean isSpecialRankNickname(String nickname) {
        if (!StringUtils.hasText(nickname)) return false;
        String value = nickname.trim();
        return value.startsWith("神秘人") || value.startsWith("dou") || value.startsWith("神秘嘉宾");
    }

    private String getRankSnapshotKey(String roomId, String version, String config, String nickname) {
        return TIKTOK_RANK_SNAPSHOT_PREFIX + roomId + ':' + version + ':' + config + ':' + (nickname == null ? "" : nickname.trim());
    }

    private String getSecUid(Object userInfo) {
        if (userInfo instanceof TiktokLiveRankUserInfoModel item) {
            return item.getSecUid();
        }
        if (userInfo instanceof TiktokLiveRankSimpleUserInfoModel item) {
            return item.getSecUid();
        }
        return null;
    }

    private String getRankNickname(Object userInfo) {
        if (userInfo instanceof TiktokLiveRankUserInfoModel item) return item.getNickname();
        if (userInfo instanceof TiktokLiveRankSimpleUserInfoModel item) return item.getNickname();
        return null;
    }

    private HashMap<String, String> executeMaskedRankNickname(Object userInfo) {
        HashMap<String, String> result = new HashMap<>();
        String originalSecUid = getSecUid(userInfo);
        String nickname = getRankNickname(userInfo);
        if (!StringUtils.hasText(originalSecUid) || !StringUtils.hasText(nickname)) return result;
        try {
            Map<String, Object> resolved = getSpecialRankNicknameFromCdn(nickname);
            String realNickname = Objects.toString(resolved.get("nickname"), "");
            if (StringUtils.hasText(realNickname)) setRankCdnData(userInfo, resolved.get("extra"));
            if (StringUtils.hasText(realNickname)) result.put(originalSecUid, realNickname);
        } catch (Exception exception) {
            logger.info("[executeMaskedRankNickname] CDN lookup failed for nickname: {}, error: {}",
                    nickname, exception.getMessage());
        }
        return result;
    }

    private Map<String, Object> getSpecialRankNicknameFromCdn(String nickname) throws IOException, URISyntaxException {
        Map<String, Object> cachedUser = getSpecialRankUserFromCdn(nickname);
        if (cachedUser.isEmpty()) return Collections.emptyMap();
        String secUid = Objects.toString(cachedUser.get("sec_uid"), "");
        String realNickname = getRealNickName(secUid);
        if (!StringUtils.hasText(realNickname)) return Collections.emptyMap();
        Map<String, Object> result = new HashMap<>();
        result.put("nickname", realNickname);
        result.put("sec_uid", secUid);
        Object extra = cachedUser.containsKey("extra") ? cachedUser.get("extra") : cachedUser.get("extra_info");
        result.put("extra", extra instanceof Collection<?> ? extra : Collections.emptyList());
        return result;
    }

    private Map<String, Object> getSpecialRankUserFromCdn(String nickname) throws IOException, URISyntaxException {
        if (!StringUtils.hasText(nickname) || !nickname.trim().matches("^(神秘人|神秘嘉宾|dou)\\d+$")) {
            return Collections.emptyMap();
        }
        String encodedNickname = URLEncoder.encode(nickname, StandardCharsets.UTF_8).replace("+", "%20");
        String cdnResponse = HttpClientUtil.doGetWithoutTimeout(
                liveCdnUrl("/api/douyin/live/users/" + encodedNickname),
                Map.of("Accept", "application/json"), null);
        if (!StringUtils.hasText(cdnResponse)) return Collections.emptyMap();
        Map<String, Object> cachedUser = GsonUtil.toMaps(cdnResponse);
        String secUid = Objects.toString(cachedUser.get("sec_uid"), "");
        if (!StringUtils.hasText(secUid)) return Collections.emptyMap();
        return cachedUser;
    }

    private String cdnUserAccount(Map<String, Object> user) {
        Long shortId = longValue(user.get("short_id"));
        if (shortId != null && shortId > 0) return String.valueOf(shortId);
        Long id = longValue(user.get("id"));
        if (id != null && id > 0) return String.valueOf(id);
        return Objects.toString(user.get("sec_uid"), "");
    }

    private void setRankCdnData(Object userInfo, Object extra) {
        Object normalizedExtra = extra instanceof Collection<?> ? extra : Collections.emptyList();
        if (userInfo instanceof TiktokLiveRankUserInfoModel item) {
            item.setExtra(normalizedExtra);
            item.setCdnResolved(true);
        }
        if (userInfo instanceof TiktokLiveRankSimpleUserInfoModel item) {
            item.setExtra(normalizedExtra);
            item.setCdnResolved(true);
        }
    }

    private boolean isMaskedUser(Object userInfo) {
        if (userInfo instanceof TiktokLiveRankUserInfoModel item) {
            return isMaskedId(item.getId(), item.getShortId(), item.getDisplayId(), item.getSecUid());
        }
        if (userInfo instanceof TiktokLiveRankSimpleUserInfoModel item) {
            return isMaskedId(item.getId(), item.getShortId(), item.getDisplayId(), item.getSecUid());
        }
        return false;
    }

    private boolean isMaskedId(Long id, Long shortId, String displayId, String secUid) {
        // 按页面展示的账号区分处理方式：账号不是 111111 时，即使内部 id、
        // short_id 或 sec_uid 呈现特殊值，也优先用该记录携带的 sec_uid 直接查询。
        // 只有账号明确为 111111 的 dou/神秘用户才留给后续 CDN 特殊处理。
        return MASKED_USER_ID.equals(displayId);
    }

    private <T> HashMap<String, String> execute(List<T> userInfoList) {
        HashMap<String, String> data = new HashMap<>();
        for (Object userInfo : userInfoList) {
            String nickname = null;
            String secUserId = null;
            try {
                if (!Objects.isNull(userInfo)) {
                    if (userInfo instanceof TiktokLiveRankUserInfoModel) {
                        secUserId = (((TiktokLiveRankUserInfoModel) userInfo).getSecUid());
                        nickname = getRealNickName(secUserId);
                    }
                    if (userInfo instanceof TiktokLiveRankSimpleUserInfoModel) {
                        secUserId = ((TiktokLiveRankSimpleUserInfoModel) userInfo).getSecUid();
                        nickname = getRealNickName(secUserId);
                    }
                }
                data.put(secUserId, nickname);
                // logger.info("[multiThreadRealNickNameExecuter] on solved: {}, thread: {}", userInfoList.size(), Thread.currentThread().getName());
            } catch (Exception e) {
                logger.info("[multiThreadRealNickNameExecuter] on solved error: {}, thread: {}", e.getMessage(), Thread.currentThread().getName());
                e.printStackTrace();
            }
        }
        return data;
    }

    private ArrayList<TiktokLiveRankUserInfoModel> getDataListByPrefix(ArrayList<TiktokLiveRankUserInfoModel> data, String prefix) {
        ArrayList<TiktokLiveRankUserInfoModel> tmp = new ArrayList<>();
        String normalizedPrefix = normalizeKeyword(prefix);
        for (TiktokLiveRankUserInfoModel userInfo : data) {
            if (containsKeyword(userInfo.getNickname(), normalizedPrefix)
                    || containsKeyword(userInfo.getUserRealNickName(), normalizedPrefix)) {
                tmp.add(userInfo);
            }
        }
        return tmp;
    }

    private ArrayList<TiktokLiveRankSimpleUserInfoModel> getSimpleDataListByPrefix(ArrayList<TiktokLiveRankSimpleUserInfoModel> data, String prefix) {
        ArrayList<TiktokLiveRankSimpleUserInfoModel> tmp = new ArrayList<>();
        String normalizedPrefix = normalizeKeyword(prefix);
        for (TiktokLiveRankSimpleUserInfoModel userInfo : data) {
            if (containsKeyword(userInfo.getNickname(), normalizedPrefix)
                    || containsKeyword(userInfo.getUserRealNickName(), normalizedPrefix)) {
                tmp.add(userInfo);
            }
        }
        return tmp;
    }

    private ArrayList<String> buildRankListSpecial(String proRankListUrl, ArrayList<String> fallbackSpecialList) {
        if (!StringUtils.hasText(proRankListUrl)) {
            return fallbackSpecialList == null ? new ArrayList<>() : fallbackSpecialList;
        }
        ArrayList<String> specialList = new ArrayList<>();
        specialList.add(buildRankListFilterUrl(proRankListUrl, "神秘人"));
        specialList.add(buildRankListFilterUrl(proRankListUrl, "dou"));
        specialList.add(buildRankListFilterUrl(proRankListUrl, "神秘嘉宾"));
        return specialList;
    }

    private String buildRankListFilterUrl(String baseUrl, String nickname) {
        String cleanUrl = removeQueryParam(removeQueryParam(removeQueryParam(baseUrl, "nickname"), "config"), "count");
        String separator = cleanUrl.contains("?") ? "&" : "?";
        return cleanUrl + separator + "config=2&nickname=" + URLEncoder.encode(nickname, StandardCharsets.UTF_8);
    }

    private String removeQueryParam(String url, String paramName) {
        return url
                .replaceAll("([?&])" + paramName + "=[^&]*&", "$1")
                .replaceAll("([?&])" + paramName + "=[^&]*$", "")
                .replace("?&", "?")
                .replaceAll("\\?$", "");
    }

    private String normalizeKeyword(String keyword) {
        return keyword == null ? "" : keyword
                .trim()
                .toLowerCase(Locale.ROOT)
                .replaceAll("[\\s\\p{Cf}\\uFE0E\\uFE0F]+", "");
    }

    private boolean containsKeyword(String value, String normalizedKeyword) {
        return normalizedKeyword.isEmpty()
                || (value != null && normalizeKeyword(value).contains(normalizedKeyword));
    }

}
