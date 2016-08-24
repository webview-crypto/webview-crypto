import {parse, stringify} from "../src/serializeBinary";
import {subtle} from "../src/compat";

declare var require: any;
const serializeError: any = require("serialize-error");

class WebViewWorker {
  constructor(private sendToMain: (message: string) => void) {
    sendToMain("We are ready!");
  }

  async onMainMessage (message) {
    let id, method, args;
    try {
      ({id, method, args} = await parse(message));
    } catch (e) {
      await this.send({
        reason: `Couldn't parse data: ${e}`
      });
      return;
    }
    let value;

    try {
      if (method === "getRandomValues") {
        value = crypto.getRandomValues(args[0]);

      } else {
        const methodName = method.split(".")[1];
        console.log(methodName, args);
        value = await subtle()[methodName].apply(subtle(), args);
      }
    } catch (e) {
      await this.send({id, reason: (serializeError as any)(e)});
      return;
    }
    await this.send({id, value});
  }

  async send(data: any) {
    let message: string;
    try {
      message = await stringify(data);
    } catch (e) {
      const newData = {
        id: data.id,
        reason: `stringify error ${e}`
      };
      this.sendToMain(JSON.stringify(newData));
      return;
    }
    this.sendToMain(message);
  }
}

export = WebViewWorker;
