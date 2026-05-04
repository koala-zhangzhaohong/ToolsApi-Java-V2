package com.koala.web.template;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.ui.Model;

public interface BaseTemplate {

    String getTemplate(String data, Model model, HttpServletResponse response);

}
