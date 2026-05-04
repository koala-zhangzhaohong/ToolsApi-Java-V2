package com.koala.web.template.index.tiktokSearcherTemplate;

import com.koala.web.template.BaseTemplate;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ui.Model;

import static com.koala.base.enums.TemplateEnum.TEMPLATE_TIKTOK_API;

public class TiktokApiTemplateWeb implements BaseTemplate {

    private static final Logger logger = LoggerFactory.getLogger(TiktokApiTemplateWeb.class);

    public TiktokApiTemplateWeb() {
        logger.info("[TemplateManager] useTemplate: {}", TEMPLATE_TIKTOK_API.getName());
    }

    @Override
    public String getTemplate(String data, Model model, HttpServletResponse response) {
        return TEMPLATE_TIKTOK_API.getPath();
    }
}
