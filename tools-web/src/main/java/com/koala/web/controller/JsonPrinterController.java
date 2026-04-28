package com.koala.web.controller;

import com.koala.service.custom.http.annotation.HttpRequestRecorder;
import com.koala.service.data.redis.service.RedisService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.hc.core5.http.HttpStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.util.ObjectUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import static com.koala.service.data.redis.RedisKeyPrefix.JSON_KEY_PREFIX;

@Controller
@RequestMapping("tools/json")
public class JsonPrinterController {

    private static final Logger logger = LoggerFactory.getLogger(JsonPrinterController.class);

    @Resource(name = "RedisService")
    private RedisService redisService;

    @HttpRequestRecorder
    @GetMapping("/printer")
    public String printer(Model model) {
        model.addAttribute("title", "JsonPrinter");
        return "json/index";
    }

    @HttpRequestRecorder
    @GetMapping("/printer/pro")
    public String printerPro(@RequestParam(required = false) String key, HttpServletRequest request, Model model, HttpServletResponse response) {
        if (ObjectUtils.isEmpty(key)) {
            response.setStatus(HttpStatus.SC_NOT_FOUND);
            return "404/index";
        }
        String jsonData = redisService.get(JSON_KEY_PREFIX + key);
        if (ObjectUtils.isEmpty(jsonData)) {
            response.setStatus(HttpStatus.SC_NOT_FOUND);
            return "404/index";
        }
        model.addAttribute("title", "JsonPrinterPro");
        model.addAttribute("jsonData", jsonData);
        return "json/pro/index";
    }
}
