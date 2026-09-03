package com.koala.factory.extra.netease;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class NeteaseCookieUtilTest {

    @Test
    void parsesOnlyCookiePairs() {
        LinkedHashMap<String, String> cookies = NeteaseCookieUtil.parseCookieHeader(
                "MUSIC_U=session; Path=/; Expires=Fri, 14 Aug 2026 00:00:00 GMT; __csrf=csrf; MUSIC_U=stale");

        assertEquals("session", cookies.get("MUSIC_U"));
        assertEquals("csrf", cookies.get("__csrf"));
        assertFalse(cookies.containsKey("Path"));
        assertFalse(cookies.containsKey("Expires"));
    }

    @Test
    void mergesRefreshTokensWithoutReplacingSessionCookie() {
        LinkedHashMap<String, String> current = NeteaseCookieUtil.parseCookieHeader(
                "MUSIC_U=session; __csrf=csrf; NMTID=device; MUSIC_A_T=old-a; MUSIC_R_T=old-r");

        LinkedHashMap<String, String> merged = NeteaseCookieUtil.mergeSetCookieHeaders(current, List.of(
                "MUSIC_A_T=new-a; Max-Age=1296000; Path=/; HttpOnly",
                "MUSIC_R_T=new-r; Max-Age=1296000; Path=/; HttpOnly"));

        assertEquals("session", merged.get("MUSIC_U"));
        assertEquals("csrf", merged.get("__csrf"));
        assertEquals("device", merged.get("NMTID"));
        assertEquals("new-a", merged.get("MUSIC_A_T"));
        assertEquals("new-r", merged.get("MUSIC_R_T"));
        assertFalse(NeteaseCookieUtil.formatCookieHeader(merged).contains("Path="));
    }
}
