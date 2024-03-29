import "https://deno.land/x/dotenv@v3.2.0/load.ts";
import client from "../../config.ts";
import { User } from "../models/user.ts";

import { jwtKey } from "../middleWares/cryptoKey.ts";
import { addUser } from "./users.ts";
import {
  Context,
  createToken,
  // getNumericDate,
  Header,
  Payload,
} from "../deps.ts";

const login = async (ctx: Context) => {
  const header: Header = {
    alg: "HS512",
    typ: "Bearer",
  };

  if (!ctx.request.hasBody) {
    ctx.response.status = 400;
    ctx.response.body = {
      success: false,
      msg: "Body is missing.!",
    };
  } else {
    const body = ctx.request.body();
    const user: User = await body.value;
    await addUser(ctx);

    try {
      await client.connect();

      const result = await client.queryArray(
        `SELECT * FROM users WHERE mobile = $1 AND "isDeleted"=$2`,
        [user.mobile, "0"],
      );

      if (result.rows.length > 0) {
        //1. send sms via twilio

        const payload: Payload = {
          iss: user.mobile,
          // exp: getNumericDate(60),
        };

        const jwt = await createToken(header, payload, jwtKey);
        await ctx.cookies.set("jwt", jwt, {
          httpOnly: true,
          sameSite: "strict",
        });

        if (jwt) {
          ctx.response.status = 200;
          ctx.response.body = {
            mobile: user.mobile,
            jwt,
          };
          await client.queryObject(
            `UPDATE users SET "isFirstLogin"=$1 WHERE mobile=$2`,
            ["FALSE", user.mobile],
          );
        } else {
          ctx.response.status = 401;
          ctx.response.body = {
            success: false,
            msg: "Error creating JWT",
          };
        }
      }
    } catch (err) {
      ctx.response.status = 500;
      ctx.response.body = {
        msg: err.toString(),
        success: false,
      };
    } finally {
      await client.end();
    }
  }
};

export default login;
