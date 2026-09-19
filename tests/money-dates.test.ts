import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { centsToInput, parseMoneyToCents, profitMargin } from "@/lib/money";
import { daysBetween, describeDeadline, lastMonths, parseDateInput, toDateInputValue } from "@/lib/dates";

describe("parseMoneyToCents", () => {
  test("entende os formatos que alguém realmente digita", () => {
    assert.equal(parseMoneyToCents("1500"), 150_000);
    assert.equal(parseMoneyToCents("1500,50"), 150_050);
    assert.equal(parseMoneyToCents("1.500,50"), 150_050);
    assert.equal(parseMoneyToCents("1500.50"), 150_050);
    assert.equal(parseMoneyToCents("R$ 1.500,00"), 150_000);
    assert.equal(parseMoneyToCents("0"), 0);
  });

  test("recusa o que não é número", () => {
    for (const input of ["", "   ", "abc", "1,2,3", null, undefined]) {
      assert.equal(parseMoneyToCents(input), null, String(input));
    }
  });

  test("não perde centavo na ida e volta", () => {
    for (const cents of [1, 99, 100, 150_050, 999_999]) {
      assert.equal(parseMoneyToCents(centsToInput(cents)), cents);
    }
  });
});

describe("profitMargin", () => {
  test("calcula a margem em porcentagem", () => {
    assert.equal(profitMargin(300_000, 100_000), 67);
    assert.equal(profitMargin(100_000, 100_000), 0);
    assert.equal(profitMargin(100_000, 150_000), -50);
  });

  test("sem receita não existe margem", () => {
    assert.equal(profitMargin(0, 50_000), null);
  });
});

describe("prazos", () => {
  const hoje = new Date(2026, 8, 18, 15, 0, 0);

  test("conta dias de calendário, não horas", () => {
    // Prazo hoje às 23h continua sendo "hoje" mesmo às 15h.
    const info = describeDeadline(new Date(2026, 8, 18, 23, 0, 0), null, hoje);
    assert.equal(info.daysLeft, 0);
    assert.equal(info.isToday, true);
    assert.equal(info.isOverdue, false);
    assert.equal(info.label, "Vence hoje");
  });

  test("descreve prazo futuro e atraso", () => {
    assert.equal(describeDeadline(new Date(2026, 8, 30), null, hoje).label, "Faltam 12 dias");
    assert.equal(describeDeadline(new Date(2026, 8, 15), null, hoje).label, "Atrasado há 3 dias");
    assert.equal(describeDeadline(new Date(2026, 8, 19), null, hoje).label, "Faltam 1 dia");
  });

  test("percentual do prazo usado depende de haver data de início", () => {
    const semInicio = describeDeadline(new Date(2026, 8, 30), null, hoje);
    assert.equal(semInicio.percentUsed, null);

    const comInicio = describeDeadline(new Date(2026, 8, 28), new Date(2026, 8, 8), hoje);
    assert.equal(comInicio.daysRunning, 10);
    assert.equal(comInicio.percentUsed, 50);
  });

  test("prazo estourado trava o percentual em 100", () => {
    const info = describeDeadline(new Date(2026, 8, 10), new Date(2026, 8, 1), hoje);
    assert.equal(info.percentUsed, 100);
  });
});

describe("campos de data", () => {
  test("ida e volta usa o fuso local, não UTC", () => {
    const date = new Date(2026, 0, 1);
    assert.equal(toDateInputValue(date), "2026-01-01");
    assert.equal(parseDateInput("2026-01-01")?.getDate(), 1);
    assert.equal(parseDateInput("2026-01-01")?.getMonth(), 0);
  });

  test("valor inválido vira null", () => {
    for (const value of ["", "18/09/2026", "2026-13-40x", null]) {
      assert.equal(parseDateInput(value), null, String(value));
    }
  });
});

describe("lastMonths", () => {
  test("devolve N meses terminando no mês atual", () => {
    const meses = lastMonths(6, new Date(2026, 8, 18));
    assert.equal(meses.length, 6);
    assert.equal(meses[0].getMonth(), 3);
    assert.equal(meses[5].getMonth(), 8);
    assert.equal(daysBetween(meses[5], new Date(2026, 8, 1)), 0);
  });
});
