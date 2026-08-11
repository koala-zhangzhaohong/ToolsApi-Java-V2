package com.koala.web.controller;

import com.koala.base.enums.LanZouResponseEnums;
import com.koala.base.enums.LanZouTypeEnums;
import com.koala.data.models.file.FileInfoModel;
import com.koala.factory.builder.ConcreteLanZouApiV2Builder;
import com.koala.factory.builder.LanZouApiV2Builder;
import com.koala.factory.director.LanZouApiV2Manager;
import com.koala.factory.product.LanZouApiV2Product;
import com.koala.service.custom.http.annotation.HttpRequestRecorder;
import com.koala.service.utils.HttpClientUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.ObjectUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import static com.koala.service.utils.RespUtil.formatRespData;
import static com.koala.service.utils.RespUtil.formatRespDataWithCustomMsg;

/**
 * @author koala
 * @version 1.0
 * @date 2022/2/11 16:30
 * @description
 */
@RestController
@RequestMapping("tools/LanZou")
public class LanZouToolsController {

    private static final Logger logger = LoggerFactory.getLogger(LanZouToolsController.class);

    private static final String LANZOU = "lanzou";

    /**
     * @param url
     * @param password
     * @param type
     * @param response
     * @return
     * @throws IOException
     * @throws URISyntaxException
     */
    @HttpRequestRecorder
    @GetMapping("api")
    public Object getLanZouInfos(@RequestParam(value = "url", required = false) String url, @RequestParam(value = "password", required = false) String password, @RequestParam(value = "type", required = false, defaultValue = "info") String type, HttpServletRequest request, HttpServletResponse response) throws IOException, URISyntaxException {
        logger.info("LanZouApi: params: {url={}, hasPassword={}, type={}}", url, !ObjectUtils.isEmpty(password), type);
        if (Boolean.FALSE.equals(checkLanZouUrl(url))) {
            return formatRespData(LanZouResponseEnums.INVALID_URL, null);
        }
        int typeId = LanZouTypeEnums.getTypeIdByType(type);
        if (Objects.equals(typeId, LanZouTypeEnums.INVALID_TYPE.getTypeId())) {
            return formatRespData(LanZouResponseEnums.INVALID_TYPE, null);
        }
        // 初始化product
        LanZouApiV2Builder builder = new ConcreteLanZouApiV2Builder();
        LanZouApiV2Manager manager = new LanZouApiV2Manager(builder);
        LanZouApiV2Product product = null;
        try {
            product = manager.construct(url, password);
        } catch (Exception e) {
            e.printStackTrace();
            return formatRespData(LanZouResponseEnums.FAILURE, null);
        }
        if (Objects.isNull(product.getHtmlData())) {
            return formatRespData(LanZouResponseEnums.GET_DATA_ERROR, null);
        }
        Optional<Map.Entry<Integer, String>> optional = product.checkStatus().entrySet().stream().findFirst();
        if (optional.isPresent()) {
            if (Objects.equals(optional.get().getKey(), LanZouResponseEnums.GET_FILE_WITH_PASSWORD.getCode()) && ObjectUtils.isEmpty(password)) {
                return formatRespData(LanZouResponseEnums.GET_FILE_WITH_PASSWORD, null);
            }
            if (!Objects.equals(optional.get().getKey(), LanZouResponseEnums.GET_FILE_SUCCESS.getCode()) && !Objects.equals(optional.get().getKey(), LanZouResponseEnums.GET_FILE_WITH_PASSWORD.getCode())) {
                return formatRespDataWithCustomMsg(optional.get().getKey(), optional.get().getValue(), null);
            }
            // 处理数据
            Object fileInfo = product.getInfo(product.getHtmlData());
            if (fileInfo instanceof FileInfoModel) {
                switch (Objects.requireNonNull(LanZouTypeEnums.getEnumsByType(type))) {
                    case DOWNLOAD:
                        FileInfoModel downloadFile = (FileInfoModel) fileInfo;
                        String downloadUrl = product.resolveDownloadUrl(downloadFile);
                        if (ObjectUtils.isEmpty(downloadUrl)) {
                            return formatRespData(LanZouResponseEnums.FAILURE, fileInfo);
                        }
                        HashMap<String, String> responseHeaders = new HashMap<>();
                        String encodedName = URLEncoder.encode(downloadFile.getFileName(), StandardCharsets.UTF_8)
                                .replace("+", "%20");
                        responseHeaders.put("Content-Disposition", "attachment; filename*=UTF-8''" + encodedName);
                        HttpClientUtil.doRelay(downloadUrl, product.getDownloadRelayHeaders(), null, 206,
                                responseHeaders, request, response);
                        return null;
                    case INFO:
                        return formatRespData(LanZouResponseEnums.GET_FILE_SUCCESS, fileInfo);
                    default:
                        return formatRespData(LanZouResponseEnums.INVALID_TYPE, null);
                }
            } else if (fileInfo instanceof ArrayList<?>) {
                return formatRespData(LanZouResponseEnums.GET_FILE_SUCCESS, fileInfo);
            } else {
                return formatRespData(LanZouResponseEnums.GET_FILE_ERROR_WITH_PASSWORD, null);
            }
        }
        return formatRespData(LanZouResponseEnums.FAILURE, null);
    }

    private Boolean checkLanZouUrl(String url) {
        return !Objects.isNull(url) && url.contains(LANZOU);
    }
}
