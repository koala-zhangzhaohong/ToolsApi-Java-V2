package com.koala.service.utils;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AcwUtils {

    @Getter
    private static String acwPath;

    @Value("${lanzou.acw}")  //删除掉static
    public void setAcwPath(String acwPath) {
        AcwUtils.acwPath = acwPath;
    }

    public String unsBox(String arg1) {
        int[] _0x4b082b = new int[]{0xf, 0x23, 0x1d, 0x18, 0x21, 0x10, 0x1, 0x26, 0xa, 0x9, 0x13, 0x1f, 0x28, 0x1b, 0x16, 0x17, 0x19, 0xd, 0x6, 0xb, 0x27, 0x12, 0x14, 0x8, 0xe, 0x15, 0x20, 0x1a, 0x2, 0x1e, 0x7, 0x4, 0x11, 0x5, 0x3, 0x1c, 0x22, 0x25, 0xc, 0x24};
        char[] _0x4da0dc = new char[arg1.length()];
        String _0x12605e = "";
        for (int _0x20a7bf = 0; _0x20a7bf < arg1.length(); _0x20a7bf++) {
            char _0x385ee3 = arg1.charAt(_0x20a7bf);
            for (int _0x217721 = 0; _0x217721 < _0x4b082b.length; _0x217721++) {
                if (_0x4b082b[_0x217721] == _0x20a7bf + 1) {
                    _0x4da0dc[_0x217721] = _0x385ee3;
                }
            }
        }
        for (char c : _0x4da0dc) {
            _0x12605e += String.valueOf(c);
        }
        return _0x12605e;
    }

    public String hexXor(String s1, String _0x4e08d8) {
        String _0x5a5d3b = "";
        for (int _0xe89588 = 0; _0xe89588 < s1.length() && _0xe89588 < _0x4e08d8.length(); _0xe89588 += 2) {
            int _0x401af1 = Integer.parseInt(s1.substring(_0xe89588, _0xe89588 + 2), 16);
            int _0x105f59 = Integer.parseInt(_0x4e08d8.substring(_0xe89588, _0xe89588 + 2), 16);
            int _0x189e2c_10 = _0x401af1 ^ _0x105f59;
            String _0x189e2c = Integer.toHexString(_0x189e2c_10);
            if (_0x189e2c.length() == 1) {
                _0x189e2c = '0' + _0x189e2c;
            }
            _0x5a5d3b += _0x189e2c;
        }
        return _0x5a5d3b;
    }

}
