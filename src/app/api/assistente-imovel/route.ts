import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Este endpoint foi substituído. Use a rota gratuita de proximidades ou gere a descrição no formulário.' },
    { status: 410 }
  );
}
