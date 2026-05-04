package com.koala.web.template.index.errorTemplate;

import com.koala.web.template.BaseTemplate;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.hc.core5.http.HttpStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.ui.Model;

import static com.koala.base.enums.TemplateEnum.TEMPLATE_403_WEB;
import static com.koala.base.enums.TemplateEnum.TEMPLATE_404_WEB;

@Component
public class NoPermissionTemplateWeb implements BaseTemplate {

    private static final Logger logger = LoggerFactory.getLogger(NoPermissionTemplateWeb.class);

    public NoPermissionTemplateWeb() {
        logger.info("[TemplateManager] useTemplate: {}", TEMPLATE_403_WEB.getName());
    }

    @Override
    public String getTemplate(String data, Model model, HttpServletResponse response) {
        response.setStatus(HttpStatus.SC_FORBIDDEN);
        return TEMPLATE_403_WEB.getPath();
    }
}
