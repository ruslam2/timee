import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { post, tokens } from "../api";
import { ErrorText, Field } from "../components/ui";
import { useI18n } from "../i18n";

export default function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [phone, setPhone] = useState("+998");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const requestCode = async () => {
    setError(null);
    try {
      const r = await post<{ debug_code: string | null }>("/auth/otp/request", { phone });
      setDevCode(r.debug_code);
      setStep("code");
    } catch (e) {
      setError(e);
    }
  };

  const verify = async () => {
    setError(null);
    try {
      const r = await post<{ access_token: string; refresh_token: string }>("/auth/otp/verify", {
        phone,
        code,
      });
      tokens.set(r.access_token, r.refresh_token);
      await qc.invalidateQueries();
      navigate("/");
    } catch (e) {
      setError(e);
    }
  };

  return (
    <div className="narrow card">
      <h2>{t("login")}</h2>
      {step === "phone" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            requestCode();
          }}
        >
          <Field label={t("phone")}>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </Field>
          <button className="primary">{t("getCode")}</button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
        >
          <Field label={t("code")}>
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" />
          </Field>
          {devCode && (
            <p className="muted">
              {t("devCode")}: <b>{devCode}</b>
            </p>
          )}
          <button className="primary">{t("confirm")}</button>
        </form>
      )}
      <ErrorText error={error} />
    </div>
  );
}
