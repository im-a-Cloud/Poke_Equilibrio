import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { forkJoin, switchMap, map } from 'rxjs';

@Component({
  selector: 'app-home-component',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './home-component.html',
  styleUrl: './home-component.css',
})
export class HomeComponent {
  nomePokemon: string = '';

  timePokemon = signal<any[]>([]);
  fraquezas = signal<string[]>([]);
  resistencias = signal<string[]>([]);
  imunidades = signal<string[]>([]);
  resultado = signal<string[]>([]);
  pokemonsImunes = signal<string[]>([]);
  pokemonsPorFraqueza = signal<Record<string, string[]>>({});

  ofensivaSuperEficaz = signal<string[]>([]);
  ofensivaPoucoEficaz = signal<string[]>([]);
  ofensivaIneficaz = signal<string[]>([]);

  balancoTipos = signal<Record<string, number>>({});
  

  fraquezasAgrupadas = computed(() => {
    const balanco = this.balancoTipos();

    const lista = Object.entries(balanco)
      .filter(([_, saldo]) => saldo > 0) // Ignora o que foi coberto (saldo <= 0)
      .map(([tipo, quantidade]) => ({ tipo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);

    return this.timePokemon().length > 1
      ? lista.filter((item) => item.quantidade > 1)
      : lista;
  });

  urlPokeAPI = 'https://pokeapi.co/api/v2/pokemon';

  constructor(private http: HttpClient) {}

  procurarPokemon() {
    if (this.timePokemon().length >= 6) {
      alert('Você já tem 6 Pokémon no time. Não é possível adicionar mais.');
      return;
    }
    if (!this.nomePokemon.trim()) return;

    const url = `${this.urlPokeAPI}/${this.nomePokemon.toLowerCase().trim()}`;

    this.http.get<any>(url).subscribe({
      next: (dadosPokemon) => {
        this.timePokemon.update((listaAtual) => [
          ...listaAtual,
          {
            nomePokemon: dadosPokemon.name,
            imagemPokemon: dadosPokemon.sprites.front_default,
            tiposPokemon: dadosPokemon.types.map((typeInfo: any) => typeInfo.type.name).join(', '),
          }
        ]);

        this.nomePokemon = '';
      },
      error: (erro) => {
        console.error('Erro ao buscar Pokémon:', erro);
        alert('Pokémon não encontrado. Por favor, verifique o nome e tente novamente.');
      }
    });
  }

  temImunidade(nomePokemon: string): boolean {
    return this.pokemonsImunes().some((item) =>
      item.toLowerCase().startsWith(nomePokemon.toLowerCase() + ' (')
    );
  }

  calculoGeral(timePokemon: any[]) {
    if (!timePokemon || timePokemon.length === 0) return;

    const requisicoesTime = timePokemon.map((pokemon) => {
      const url = `${this.urlPokeAPI}/${pokemon.nomePokemon.toLowerCase().trim()}`;

      return this.http.get<any>(url).pipe(
        switchMap((dadosPokemon) => {
          const tipos = dadosPokemon.types.map((t: any) => t.type.name);
          const reqTipos = tipos.map((tipo: string) =>
            this.http.get<any>(`https://pokeapi.co/api/v2/type/${tipo}`)
          );
          return forkJoin(reqTipos).pipe(
            map((listaDadosTipos: any) => ({
              nome: pokemon.nomePokemon,
              listaDadosTipos
            }))
          );
        })
      );
    });

  forkJoin(requisicoesTime).subscribe({
    next: (resultadosTime) => {
      const todasImunidades: string[] = [];
      const todasFraquezas: string[] = [];
      const todasResistencias: string[] = [];
      const todasFraquezasReais: string[] = [];
      const listaPokemonsImunes: string[] = [];
      const mapaFraquezas: Record<string, string[]> = {};
      const balanco: Record<string, number> = {};

      // Arrays para cobertura ofensiva
      const superEficazBruto: string[] = [];
      const poucoEficazBruto: string[] = [];
      const ineficazBruto: string[] = [];

      for (const item of resultadosTime) {
        const multiplicadores: Record<string, number> = {};
        const imunidadesDestePokemon: string[] = [];

        for (const dadosTipo of item.listaDadosTipos) {
          // --- RELAÇÕES DEFENSIVAS (*_from) ---
          const imunidadesTipo = dadosTipo.damage_relations.no_damage_from.map((t: any) => t.name);
          const fraquezasTipo = dadosTipo.damage_relations.double_damage_from.map((t: any) => t.name);
          const resistenciasTipo = dadosTipo.damage_relations.half_damage_from.map((t: any) => t.name);

          imunidadesDestePokemon.push(...imunidadesTipo);
          todasImunidades.push(...imunidadesTipo);
          todasFraquezas.push(...fraquezasTipo);
          todasResistencias.push(...resistenciasTipo);

          for (const t of fraquezasTipo) multiplicadores[t] = (multiplicadores[t] ?? 1) * 2;
          for (const t of resistenciasTipo) multiplicadores[t] = (multiplicadores[t] ?? 1) * 0.5;
          for (const t of imunidadesTipo) multiplicadores[t] = 0;

          // --- RELAÇÕES OFENSIVAS (*_to) ---
          const supTo = dadosTipo.damage_relations.double_damage_to.map((t: any) => t.name);
          const pouTo = dadosTipo.damage_relations.half_damage_to.map((t: any) => t.name);
          const ineTo = dadosTipo.damage_relations.no_damage_to.map((t: any) => t.name);

          superEficazBruto.push(...supTo);
          poucoEficazBruto.push(...pouTo);
          ineficazBruto.push(...ineTo);
        }

        if (imunidadesDestePokemon.length > 0) {
          const unicas = [...new Set(imunidadesDestePokemon)].join(', ');
          listaPokemonsImunes.push(`${item.nome} (${unicas})`);
        }

        for (const [tipo, mult] of Object.entries(multiplicadores)) {
          if (mult === 4) {
            balanco[tipo] = (balanco[tipo] ?? 0) + 2;
          } else if (mult === 2) {
            balanco[tipo] = (balanco[tipo] ?? 0) + 1;
          } else if (mult <= 0.5) {
            balanco[tipo] = (balanco[tipo] ?? 0) - 1;
          }
        }

        const fraquezasReaisPokemon = Object.keys(multiplicadores).filter(
          (t) => multiplicadores[t] > 1
        );
        todasFraquezasReais.push(...fraquezasReaisPokemon);

        for (const fraqueza of fraquezasReaisPokemon) {
          if (!mapaFraquezas[fraqueza]) {
            mapaFraquezas[fraqueza] = [];
          }

          const nomeExibicao = multiplicadores[fraqueza] === 4
            ? `${item.nome} (4x)`
            : item.nome;

          if (!mapaFraquezas[fraqueza].includes(nomeExibicao)) {
            mapaFraquezas[fraqueza].push(nomeExibicao);
          }
        }
      }

      const limite = resultadosTime.length > 1 ? 1 : 0;
      const mapaFraquezasDescobertas: Record<string, string[]> = {};
      for (const [tipo, pokemons] of Object.entries(mapaFraquezas)) {
        if ((balanco[tipo] ?? 0) > limite) {
          mapaFraquezasDescobertas[tipo] = pokemons;
        }
      }

      // Remove duplicatas e filtra pontos cegos ofensivos
      const unicosSuperEficaz = [...new Set(superEficazBruto)];
      const unicosPoucoEficaz = [...new Set(poucoEficazBruto)].filter(
        (tipo) => !unicosSuperEficaz.includes(tipo)
      );
      const unicosIneficaz = [...new Set(ineficazBruto)].filter(
        (tipo) => !unicosSuperEficaz.includes(tipo)
      );

      // Atualiza Signals defensivos
      this.imunidades.set([...new Set(todasImunidades)]);
      this.fraquezas.set(todasFraquezas);
      this.resistencias.set(todasResistencias);
      this.pokemonsImunes.set(listaPokemonsImunes);
      this.resultado.set(todasFraquezasReais);
      this.pokemonsPorFraqueza.set(mapaFraquezasDescobertas);

      // Atualiza Signals ofensivos
      this.ofensivaSuperEficaz.set(unicosSuperEficaz);
      this.ofensivaPoucoEficaz.set(unicosPoucoEficaz);
      this.ofensivaIneficaz.set(unicosIneficaz);
    },
    error: (erro) => {
      console.error('Erro ao calcular dados do time:', erro);
    }
  });
  }
  removerPokemon(index: number) {
  this.timePokemon.update((listaAtual) =>
    listaAtual.filter((_, i) => i !== index)
  );
  // Se o time ficar vazio, zera todos os signals de resultado
    if (this.timePokemon().length === 0) {
      this.fraquezas.set([]);
      this.resistencias.set([]);
      this.imunidades.set([]);
      this.resultado.set([]);
      this.pokemonsImunes.set([]);
      this.pokemonsPorFraqueza.set({});
      this.balancoTipos.set({});
    }
  }
  limparTime() {
    this.timePokemon.set([]);
    this.fraquezas.set([]);
    this.resistencias.set([]);
    this.imunidades.set([]);
    this.resultado.set([]);
    this.pokemonsImunes.set([]);
    this.pokemonsPorFraqueza.set({});
    this.balancoTipos.set({});
  }
}