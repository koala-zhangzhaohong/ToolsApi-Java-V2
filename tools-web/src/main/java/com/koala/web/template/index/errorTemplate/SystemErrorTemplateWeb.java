package com.koala.web.template.index.errorTemplate;

import com.koala.web.template.BaseTemplate;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.hc.core5.http.HttpStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.ui.Model;

import static com.koala.base.enums.TemplateEnum.TEMPLATE_404_WEB;
import static com.koala.base.enums.TemplateEnum.TEMPLATE_500_WEB;

@Component
public class SystemErrorTemplateWeb implements BaseTemplate {

    private static final Logger logger = LoggerFactory.getLogger(SystemErrorTemplateWeb.class);

    public SystemErrorTemplateWeb() {
        logger.info("[TemplateManager] useTemplate: {}", TEMPLATE_500_WEB.getName());
    }

    @Override
    public String getTemplate(String data, Model model, HttpServletResponse response) {
        response.setStatus(HttpStatus.SC_INTERNAL_SERVER_ERROR);
        return TEMPLATE_500_WEB.getPath();
    }
}
