package com.koala.web.template.index.jsonTemplate;

import com.koala.web.template.BaseTemplate;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.hc.core5.http.HttpStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.ui.Model;
import org.springframework.util.ObjectUtils;

import static com.koala.base.enums.TemplateEnum.TEMPLATE_404_WEB;
import static com.koala.base.enums.TemplateEnum.TEMPLATE_JSON_PRO_WEB;

@Component
public class JsonTemplateProWeb implements BaseTemplate {

    private static final Logger logger = LoggerFactory.getLogger(JsonTemplateProWeb.class);

    public JsonTemplateProWeb() {
        logger.info("[TemplateManager] useTemplate: {}", TEMPLATE_JSON_PRO_WEB.getName());
    }

    @Override
    public String getTemplate(String data, Model model, HttpServletResponse response) {
        if (ObjectUtils.isEmpty(data)) {
            response.setStatus(HttpStatus.SC_NOT_FOUND);
            return TEMPLATE_404_WEB.getPath();
        }
        model.addAttribute("jsonData", data);
        return TEMPLATE_JSON_PRO_WEB.getPath();
    }
}
