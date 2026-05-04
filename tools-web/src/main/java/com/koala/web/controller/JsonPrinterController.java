package com.koala.web.controller;

import com.koala.base.enums.TemplateEnum;
import com.koala.service.custom.http.annotation.HttpRequestRecorder;
import com.koala.service.data.redis.service.RedisService;
import com.koala.service.utils.GsonUtil;
import com.koala.service.utils.RestTemplateUtils;
import com.koala.web.HostManager;
import com.koala.web.template.index.errorTemplate.NoPermissionTemplateWeb;
import com.koala.web.template.index.errorTemplate.NotFoundTemplateWeb;
import com.koala.web.template.index.errorTemplate.SystemErrorTemplateWeb;
import com.koala.web.template.index.jsonTemplate.JsonTemplateProWeb;
import com.koala.web.template.index.jsonTemplate.JsonTemplateWeb;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletResponse;
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

    @Resource
    private HostManager hostManager;

    @Resource(name = "RedisService")
    private RedisService redisService;

    private final RestTemplateUtils restTemplateUtils = new RestTemplateUtils();

    private final String[] jsonWhiteList = {"tools/DouYin/api/ranklist/audience", "tools/DouYin/api/user/profile/other"};

    @HttpRequestRecorder
    @GetMapping("/printer")
    public String printer(Model model) {
        model.addAttribute("title", "JsonPrinter");
        return "json/index";
    }

    @HttpRequestRecorder
    @GetMapping("/printer/pro")
    public String printerPro(@RequestParam(required = false) String path, @RequestParam(required = false) String key, @RequestParam(required = false, defaultValue = "5") Integer id, Model model, HttpServletResponse response) {
        model.addAttribute("title", "JsonPrinterPro");
        model.addAttribute("host", hostManager.getHost());
        model.addAttribute("whiteList", GsonUtil.toString(jsonWhiteList));
        Integer autoId = TemplateEnum.getTemplateByPath(hostManager.getHost(), path);
        try {
            return switch (TemplateEnum.getTemplateById(!ObjectUtils.isEmpty(path) && !ObjectUtils.isEmpty(autoId) && !autoId.equals(-1) ? autoId : id)) {
                case TEMPLATE_403_WEB -> new NoPermissionTemplateWeb().getTemplate(null, null, response);
                case TEMPLATE_500_WEB -> new SystemErrorTemplateWeb().getTemplate(null, null, response);
                case TEMPLATE_JSON_WEB -> new JsonTemplateWeb().getTemplate(getData(path, key), model, response);
                case TEMPLATE_JSON_PRO_WEB -> new JsonTemplateProWeb().getTemplate(getData(path, key), model, response);
                default -> new NotFoundTemplateWeb().getTemplate(null, null, response);
            };
        } catch (Exception e) {
            return new SystemErrorTemplateWeb().getTemplate(null, model, response);
        }
    }

    private String getData(String path, String key) {
        if (!ObjectUtils.isEmpty(path)) {
            String jsonResponse = restTemplateUtils.get(path, String.class).getBody();
            if (!ObjectUtils.isEmpty(jsonResponse)) {
                return jsonResponse;
            }
        }
        if (ObjectUtils.isEmpty(key)) {
            return null;
        } else {
            return redisService.get(JSON_KEY_PREFIX + key);
        }
    }
}
