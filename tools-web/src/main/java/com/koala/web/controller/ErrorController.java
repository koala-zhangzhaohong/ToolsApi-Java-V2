package com.koala.web.controller;

import com.koala.service.custom.http.annotation.HttpRequestRecorder;
import com.koala.web.template.index.errorTemplate.NoPermissionTemplateWeb;
import com.koala.web.template.index.errorTemplate.NotFoundTemplateWeb;
import com.koala.web.template.index.errorTemplate.SystemErrorTemplateWeb;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.hc.core5.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * @author koala
 * @version 1.0
 * @date 2023/5/17 22:30
 * @description
 */
@Controller
@RequestMapping("error")
public class ErrorController {

    @HttpRequestRecorder
    @GetMapping("403")
    public String pageForbidden(HttpServletResponse response) {
        return new NoPermissionTemplateWeb().getTemplate(null, null, response);
    }

    @HttpRequestRecorder
    @GetMapping("404")
    public String pageNotFound(HttpServletResponse response) {
        return new NotFoundTemplateWeb().getTemplate(null, null, response);
    }

    @HttpRequestRecorder
    @GetMapping("500")
    public String internalServerError(HttpServletResponse response) {
        return new SystemErrorTemplateWeb().getTemplate(null, null, response);
    }
}
