package com.koala.web.controller;

import com.koala.service.custom.http.annotation.HttpRequestRecorder;
import com.koala.service.data.redis.service.RedisService;
import com.koala.service.utils.GsonUtil;
import com.koala.service.utils.RestTemplateUtils;
import com.koala.web.HostManager;
import jakarta.annotation.Resource;
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
@RequestMapping("tools/DouYin/web")
public class DouYinWebController {

    private static final Logger logger = LoggerFactory.getLogger(DouYinWebController.class);

    @Resource
    private HostManager hostManager;

    @Resource(name = "RedisService")
    private RedisService redisService;

    private final RestTemplateUtils restTemplateUtils = new RestTemplateUtils();

    @HttpRequestRecorder
    @GetMapping("/searcher")
    public String searcher(@RequestParam(required = false, defaultValue = "2") Integer version, Model model, HttpServletResponse response) {
        model.addAttribute("title", "Tiktok Searcher");
        model.addAttribute("host", hostManager.getHost());
        switch (version) {
            case 1:
                return "tiktok/v1/index";
            case 2:
                return "tiktok/v2/index";
        }
        response.setStatus(HttpStatus.SC_NOT_FOUND);
        return "404/index";
    }
}
