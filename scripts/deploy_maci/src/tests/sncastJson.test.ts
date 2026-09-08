import { describe, expect, test } from "vitest";

import { extractJsonObjects, parseSncastField } from "../sncastJson.js";

const DECLARE_SUCCESS = `
{"type":"warn","message":"workspace members definition matched path"}
{"class_hash":"0x027127d5fcb03820884be3af594d927913b4047b42f227da7214d54b7e2ff326","command":"declare","transaction_hash":"0x01","type":"response"}
`;

const ALREADY_DECLARED = `
{"type":"warn","message":"workspace members"}
{"command":"declare","error":"Contract with class hash 0x0273dc8d1b3bf53b71ce08e6f29fdcd12b0d4a2c7fabc1aa3f03ec8e19bfb577 is already declared","type":"error"}
`;

const DEPLOY_SUCCESS = `
{"command":"deploy","contract_address":"0x01cba90aa49107aba9ae57d69a2f5fab2d80e6e92113d6beff028d1423d16237","transaction_hash":"0x06","type":"response"}
`;

const CALL_ADDRESS = `
{"command":"call","response":"0x123","response_raw":["0x64b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691"],"type":"response"}
`;

const INVOKE_SUCCESS = `
{"command":"invoke","transaction_hash":"0x0340abee4ccd74d90ba67b9c95cad3f5ca686356275f82bea4198ce4750e2d9d","type":"response"}
`;

describe("parseSncastField", () => {
  test("reads class_hash from a successful declare", () => {
    expect(parseSncastField(DECLARE_SUCCESS, "class_hash")).toBe(
      "0x027127d5fcb03820884be3af594d927913b4047b42f227da7214d54b7e2ff326",
    );
  });

  test("reads class_hash from an already-declared error", () => {
    expect(parseSncastField(ALREADY_DECLARED, "class_hash")).toBe(
      "0x0273dc8d1b3bf53b71ce08e6f29fdcd12b0d4a2c7fabc1aa3f03ec8e19bfb577",
    );
  });

  test("reads contract_address from a successful deploy", () => {
    expect(parseSncastField(DEPLOY_SUCCESS, "contract_address")).toBe(
      "0x01cba90aa49107aba9ae57d69a2f5fab2d80e6e92113d6beff028d1423d16237",
    );
  });

  test("prefers response_raw for call results", () => {
    expect(parseSncastField(CALL_ADDRESS, "response")).toBe(
      "0x64b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691",
    );
  });

  test("reads transaction_hash from a successful invoke", () => {
    expect(parseSncastField(INVOKE_SUCCESS, "transaction_hash")).toBe(
      "0x0340abee4ccd74d90ba67b9c95cad3f5ca686356275f82bea4198ce4750e2d9d",
    );
  });

  test("does not invent a response for invoke", () => {
    expect(() => {
      parseSncastField(INVOKE_SUCCESS, "response");
    }).toThrow("missing JSON field response");
  });

  test("throws on other sncast errors", () => {
    expect(() => {
      parseSncastField(
        '{"command":"declare","error":"Error while calling RPC method spec_version","type":"error"}',
        "class_hash",
      );
    }).toThrow("Error while calling RPC method spec_version");
  });

  test("throws when output has no JSON object", () => {
    expect(() => {
      parseSncastField("warn: compiling", "class_hash");
    }).toThrow("sncast output had no JSON object");
  });

  test("throws when JSON objects are only warnings", () => {
    expect(() => {
      parseSncastField('{"type":"warn","message":"workspace members"}', "class_hash");
    }).toThrow("sncast output had no JSON object");
  });

  test("throws when the requested field is missing", () => {
    expect(() => {
      parseSncastField('{"command":"deploy","type":"response"}', "contract_address");
    }).toThrow("missing JSON field contract_address");
  });

  test("throws when response_raw is empty", () => {
    expect(() => {
      parseSncastField('{"command":"call","response_raw":[],"type":"response"}', "response");
    }).toThrow("empty response_raw");
  });

  test("reads the first element of a JSON list field", () => {
    expect(parseSncastField('{"command":"declare","class_hash":["0xabc"],"type":"response"}', "class_hash")).toBe(
      "0xabc",
    );
  });

  test("throws when a JSON list field is empty", () => {
    expect(() => {
      parseSncastField('{"command":"declare","class_hash":[],"type":"response"}', "class_hash");
    }).toThrow("empty JSON list for class_hash");
  });

  test("stringifies a non-string sncast error object", () => {
    expect(() => {
      parseSncastField('{"command":"deploy","error":{"code":1},"type":"error"}', "contract_address");
    }).toThrow('{"command":"deploy","error":{"code":1},"type":"error"}');
  });
});

describe("extractJsonObjects", () => {
  test("skips non-JSON text and parses concatenated objects", () => {
    expect(
      extractJsonObjects('warn: skip {"type":"warn"}{"command":"declare","type":"response","class_hash":"0x1"}'),
    ).toEqual([{ type: "warn" }, { command: "declare", type: "response", class_hash: "0x1" }]);
  });

  test("parses JSON with escaped quotes inside strings", () => {
    expect(extractJsonObjects('{"message":"say \\"hi\\""}')).toEqual([{ message: 'say "hi"' }]);
  });

  test("stops at an unclosed JSON object", () => {
    expect(extractJsonObjects('{"type":"warn"')).toEqual([]);
  });
});
