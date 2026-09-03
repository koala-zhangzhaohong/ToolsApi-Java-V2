package com.koala.factory.extra.netease;

import com.google.gson.Gson;
import com.koala.data.models.netease.itemInfo.NeteaseMusicItemInfoRespModel;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class NeteaseMusicItemInfoRespModelTest {

    @Test
    void acceptsDecimalGainFromPlayerUrlResponse() {
        NeteaseMusicItemInfoRespModel response = new Gson().fromJson(
                "{\"data\":[{\"id\":108914,\"code\":200,\"gain\":-6.2058}],\"code\":200}",
                NeteaseMusicItemInfoRespModel.class);

        assertEquals(-6.2058D, response.getData().get(0).getGain());
    }
}
