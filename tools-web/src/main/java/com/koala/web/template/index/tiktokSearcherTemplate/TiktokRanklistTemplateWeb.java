package com.koala.web.template.index.tiktokSearcherTemplate;

import com.koala.data.models.douyin.rank.TiktokLiveRankSimpleUserInfoModel;
import com.koala.service.utils.GsonUtil;
import com.koala.web.template.BaseTemplate;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ui.Model;

import java.util.ArrayList;
import java.util.Map;

import static com.koala.base.enums.TemplateEnum.TEMPLATE_TIKTOK_RANKLIST;

public class TiktokRanklistTemplateWeb implements BaseTemplate {

    private static final Logger logger = LoggerFactory.getLogger(TiktokRanklistTemplateWeb.class);

    public TiktokRanklistTemplateWeb() {
        logger.info("[TemplateManager] useTemplate: {}", TEMPLATE_TIKTOK_RANKLIST.getName());
    }

    @Override
    public String getTemplate(String data, Model model, HttpServletResponse response) {
        try {
            Map<String, Object> rankData = (Map<String, Object>) GsonUtil.toMaps(data).get("data");
            if (rankData != null) {
                ArrayList<?> ranklist = (ArrayList<?>) rankData.get("userList");
                ArrayList<TiktokLiveRankSimpleUserInfoModel> userInfoList = new ArrayList<>();
                ranklist.forEach(item -> {
                    userInfoList.add(GsonUtil.toBean(GsonUtil.toString(item), TiktokLiveRankSimpleUserInfoModel.class));
                });
                if (!userInfoList.isEmpty()) {
                    model.addAttribute("userInfoList", userInfoList);
                }
            } else {
                model.addAttribute("userInfoList", new ArrayList<>());
            }
        } catch (Exception e) {
            logger.error("[TemplateManager] error", e);
            model.addAttribute("userInfoList", new ArrayList<>());
        }
        return TEMPLATE_TIKTOK_RANKLIST.getPath();
    }
}
