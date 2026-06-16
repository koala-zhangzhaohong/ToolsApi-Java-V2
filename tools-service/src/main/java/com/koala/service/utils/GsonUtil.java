package com.koala.service.utils;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.ToNumberPolicy;

import java.util.List;
import java.util.Map;

/**
 * @author koala
 * @version 1.0
 * @date 2022/2/11 17:30
 * @description
 */
public class GsonUtil {
    /**
     * 不用创建对象,直接使用Gson.就可以调用方法
     */
    private static final Gson GSON;

    //判断gson对象是否存在了,不存在则创建对象
    static {
        //当使用GsonBuilder方式时属性为空的时候输出来的json字符串是有键值key的,显示形式是"key":null，而直接new出来的就没有"key":null的
        GSON = new GsonBuilder().setNumberToNumberStrategy(ToNumberPolicy.LONG_OR_DOUBLE).setObjectToNumberStrategy(ToNumberPolicy.LONG_OR_DOUBLE).setDateFormat("yyyy-MM-dd HH:mm:ss").disableHtmlEscaping().create();
    }

    private GsonUtil() {
    }

    /**
     * 将对象转成json格式
     *
     * @return String
     */
    public static String toString(Object object) {
        String gsonString = null;
        if (GSON != null) {
            gsonString = GSON.toJson(object);
        }
        return gsonString;
    }

    /**
     * 将json转成特定的cls的对象
     */
    public static <T> T toBean(String gsonString, Class<T> cls) {
        T t = null;
        if (GSON != null) {
            //传入json对象和对象类型,将json转成对象
            t = GSON.fromJson(gsonString, cls);
        }
        return t;
    }

    /**
     * json字符串转成list
     */
    @SuppressWarnings("unchecked")
    public static <T> List<T> toList(String gsonString) {
        return GSON.fromJson(gsonString, List.class);
    }

    /**
     * json字符串转成list中有map的
     */
    @SuppressWarnings("unchecked")
    public static <T> List<Map<String, T>> toListMaps(String gsonString) {
        return GSON.fromJson(gsonString, List.class);
    }

    /**
     * json字符串转成map的
     */
    @SuppressWarnings("unchecked")
    public static <T> Map<String, T> toMaps(String gsonString) {
        return GSON.fromJson(gsonString, Map.class);
    }
}
