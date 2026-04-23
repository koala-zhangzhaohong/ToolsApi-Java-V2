package com.koala.factory.product;

import com.koala.data.models.file.FileInfoModel;
import com.koala.data.models.lanzou.FolderDataRespModel;
import com.koala.data.models.lanzou.FolderFileInfoRespModel;
import com.koala.data.models.lanzou.VerifyPasswordRespModel;
import com.koala.service.utils.GsonUtil;
import com.koala.service.utils.HttpClientUtil;
import com.koala.service.utils.PatternUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeanUtils;
import org.springframework.util.ObjectUtils;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.*;

import static com.koala.base.enums.LanZouResponseEnums.GET_FILE_SUCCESS;
import static com.koala.service.utils.HeaderUtil.*;

/**
 * @author koala
 * @version 1.0
 * @date 2022/2/15 16:08
 * @description
 */
public class LanZouApiV2Product {
    private static final Logger logger = LoggerFactory.getLogger(LanZouApiV2Product.class);
    private String id;
    private String url;
    private String host;
    private String password;
    private String pageData;
    private static final ArrayList<String> HOST_LIST = new ArrayList<>();
    private static final HashMap<Integer, List<String>> INVALID_LIST = new HashMap<>();

    static {
        HOST_LIST.add("https://wwwx.lanzoux.com");
        HOST_LIST.add("https://www.lanzoui.com");
        HOST_LIST.add("https://www.lanzouw.com");
        HOST_LIST.add("https://wwx.lanzouj.com");
        HOST_LIST.add("https://wwi.lanzouj.com");
        HOST_LIST.add("https://wwtr.lanzoue.com");
        INVALID_LIST.put(201, Arrays.asList("文件取消分享了", "文件不存在", "访问地址错误，请核查"));
        INVALID_LIST.put(202, List.of("输入密码"));
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public void getIdByUrl() {
        if (!ObjectUtils.isEmpty(this.url)) {
            String rule = "com/";
            this.id = this.url.substring(this.url.lastIndexOf(rule) + rule.length(), Objects.equals(this.url.lastIndexOf("/"), this.url.lastIndexOf(rule) + rule.length() - 1) ? this.url.length() : this.url.lastIndexOf("/"));
        }
    }

    public void init() {

    }
}
