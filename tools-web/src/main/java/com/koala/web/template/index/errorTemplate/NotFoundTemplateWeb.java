package com.koala.web.template.index.errorTemplate;

import com.koala.web.template.BaseTemplate;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.hc.core5.http.HttpStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ui.Model;

import static com.koala.base.enums.TemplateEnum.TEMPLATE_404_WEB;

public class NotFoundTemplateWeb implements BaseTemplate {

    private static final Logger logger = LoggerFactory.getLogger(NotFoundTemplateWeb.class);

    public NotFoundTemplateWeb() {
        logger.info("[TemplateManager] useTemplate: {}", TEMPLATE_404_WEB.getName());
    }

    @Override
    public String getTemplate(String data, Model model, HttpServletResponse response) {
        response.setStatus(HttpStatus.SC_NOT_FOUND);
        return TEMPLATE_404_WEB.getPath();
    }
}
