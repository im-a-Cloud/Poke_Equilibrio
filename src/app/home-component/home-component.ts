import { Component, signal, computed, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { forkJoin, switchMap, map, of, tap, Observable } from 'rxjs';

@Component({
  selector: 'app-home-component',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './home-component.html',
  styleUrl: './home-component.css',
})
export class HomeComponent {
  private http = inject(HttpClient);
  private urlPokeAPI = 'https://pokeapi.co/api/v2/pokemon';

  nomePokemon: string = '';
  timePokemon = signal<any[]>([]);
  fraquezas = signal<string[]>([]);
  resistencias = signal<string[]>([]);
  imunidades = signal<string[]>([]);
  resultado = signal<string[]>([]);
  pokemonsImunes = signal<string[]>([]);
  pokemonsPorFraqueza = signal<Record<string, string[]>>({});

  pokemonDetalhesIndividuais = signal<{
    nome: string;
    tipos: string[];
    fraquezas: string[];
    resistencias: string[];
    imunidades: string[];
    superEficaz: string[];
  } | null>(null);

  ofensivaSuperEficaz = signal<string[]>([]);
  ofensivaPoucoEficaz = signal<string[]>([]);
  ofensivaIneficaz = signal<string[]>([]);

  balancoTipos = signal<Record<string, number>>({});

  // Cache em memória para diminuir requisições à PokeAPI
  private cachePokemon = new Map<string, any>();
  private cacheTipos = new Map<string, any>();
  modoEscuro = signal<boolean>(false);

  private buscarDadosPokemon(nome: string): Observable<any> {
    const chave = nome.toLowerCase().trim();

    if (this.cachePokemon.has(chave)) {
      return of(this.cachePokemon.get(chave));
    }

    return this.http.get<any>(`${this.urlPokeAPI}/${chave}`).pipe(
      tap((dadosPokemon) => this.cachePokemon.set(chave, dadosPokemon))
    );
  }

  private buscarDadosTipo(tipo: string): Observable<any> {
    const chave = tipo.toLowerCase().trim();

    if (this.cacheTipos.has(chave)) {
      return of(this.cacheTipos.get(chave));
    }

    return this.http.get<any>(`https://pokeapi.co/api/v2/type/${chave}`).pipe(
      tap((dadosTipo) => this.cacheTipos.set(chave, dadosTipo))
    );
  }

  fraquezasAgrupadas = computed(() => {
    const balanco = this.balancoTipos();

    const lista = Object.entries(balanco)
      .filter(([_, saldo]) => saldo > 0)
      .map(([tipo, quantidade]) => ({ tipo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);

    return this.timePokemon().length > 1
      ? lista.filter((item) => item.quantidade > 1)
      : lista;
  });

  procurarPokemon() {
    if (this.timePokemon().length >= 6) {
      alert('Você já tem 6 Pokémon no time. Não é possível adicionar mais.');
      return;
    }
    if (!this.nomePokemon.trim()) return;

    this.buscarDadosPokemon(this.nomePokemon).subscribe({
      next: (dadosPokemon) => {
        this.timePokemon.update((listaAtual) => [
          ...listaAtual,
          {
            nomePokemon: dadosPokemon.name,
            imagemPokemon: dadosPokemon.sprites.front_default,
            tiposPokemon: dadosPokemon.types.map((typeInfo: any) => typeInfo.type.name),
          },
        ]);

        this.nomePokemon = '';
      },
      error: (erro) => {
        console.error('Erro ao buscar Pokémon:', erro);
        alert('Pokémon não encontrado. Por favor, verifique o nome e tente novamente.');
      },
    });
  }

  temImunidade(nomePokemon: string): boolean {
    return this.pokemonsImunes().some((item) =>
      item.toLowerCase().startsWith(nomePokemon.toLowerCase() + ' (')
    );
  }

  calculoGeral(timePokemon: any[]) {
    if (!timePokemon || timePokemon.length === 0) return;

    const requisicoesTime = timePokemon.map((pokemon) =>
      this.buscarDadosPokemon(pokemon.nomePokemon).pipe(
        switchMap((dadosPokemon) => {
          const tipos: string[] = dadosPokemon.types.map((t: any) => t.type.name);
          const reqTipos = tipos.map((tipo: string) => this.buscarDadosTipo(tipo));

          return forkJoin(reqTipos).pipe(
            map((listaDadosTipos: any[]) => ({
              nome: pokemon.nomePokemon,
              listaDadosTipos,
            }))
          );
        })
      )
    );

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
            // Relações defensivas (*_from)
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

            // Relações ofensivas (*_to)
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

            const nomeExibicao =
              multiplicadores[fraqueza] === 4 ? `${item.nome} (4x)` : item.nome;

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
        this.balancoTipos.set(balanco);

        // Atualiza Signals ofensivos
        this.ofensivaSuperEficaz.set(unicosSuperEficaz);
        this.ofensivaPoucoEficaz.set(unicosPoucoEficaz);
        this.ofensivaIneficaz.set(unicosIneficaz);
      },
      error: (erro) => {
        console.error('Erro ao calcular dados do time:', erro);
      },
    });
  }

  removerPokemon(index: number) {
    this.timePokemon.update((listaAtual) =>
      listaAtual.filter((_, i) => i !== index)
    );

    if (this.timePokemon().length === 0) {
      this.limparResultados();
    }
  }

  limparTime() {
    this.timePokemon.set([]);
    this.limparResultados();
  }

  private limparResultados() {
    this.fraquezas.set([]);
    this.resistencias.set([]);
    this.imunidades.set([]);
    this.resultado.set([]);
    this.pokemonsImunes.set([]);
    this.pokemonsPorFraqueza.set({});
    this.balancoTipos.set({});
    this.ofensivaSuperEficaz.set([]);
    this.ofensivaPoucoEficaz.set([]);
    this.ofensivaIneficaz.set([]);
    this.pokemonDetalhesIndividuais.set(null);
  }

  detalharPokemon(nomePokemon: string) {
    this.buscarDadosPokemon(nomePokemon)
      .pipe(
        switchMap((dadosPokemon) => {
          const tipos: string[] = dadosPokemon.types.map((t: any) => t.type.name);
          const reqTipos = tipos.map((tipo) => this.buscarDadosTipo(tipo));

          return forkJoin(reqTipos).pipe(
            map((listaDadosTipos: any[]) => ({
              nome: dadosPokemon.name,
              tipos,
              listaDadosTipos,
            }))
          );
        })
      )
      .subscribe({
        next: ({ nome, tipos, listaDadosTipos }) => {
          const multiplicadores: Record<string, number> = {};
          const superEficazSet = new Set<string>();

          for (const dadosTipo of listaDadosTipos) {
            // Defesas
            const imunidadesTipo = dadosTipo.damage_relations.no_damage_from.map((t: any) => t.name);
            const fraquezasTipo = dadosTipo.damage_relations.double_damage_from.map((t: any) => t.name);
            const resistenciasTipo = dadosTipo.damage_relations.half_damage_from.map((t: any) => t.name);

            for (const t of fraquezasTipo) multiplicadores[t] = (multiplicadores[t] ?? 1) * 2;
            for (const t of resistenciasTipo) multiplicadores[t] = (multiplicadores[t] ?? 1) * 0.5;
            for (const t of imunidadesTipo) multiplicadores[t] = 0;

            // Ofensiva
            const supTo = dadosTipo.damage_relations.double_damage_to.map((t: any) => t.name);
            supTo.forEach((t: string) => superEficazSet.add(t));
          }

          const fraquezas = Object.entries(multiplicadores)
            .filter(([_, mult]) => mult > 1)
            .map(([tipo, mult]) => (mult === 4 ? `${tipo} (4x)` : tipo));

          const resistencias = Object.entries(multiplicadores)
            .filter(([_, mult]) => mult > 0 && mult < 1)
            .map(([tipo, mult]) => (mult === 0.25 ? `${tipo} (0.25x)` : tipo));

          const imunidades = Object.entries(multiplicadores)
            .filter(([_, mult]) => mult === 0)
            .map(([tipo]) => tipo);

          this.pokemonDetalhesIndividuais.set({
            nome,
            tipos,
            fraquezas,
            resistencias,
            imunidades,
            superEficaz: [...superEficazSet],
          });
        },
        error: (erro) => {
          console.error('Erro ao buscar detalhes do Pokémon:', erro);
          alert('Não foi possível obter os detalhes do Pokémon. Por favor, tente novamente mais tarde.');
        },
      });
  }

  fecharDetalhes() {
    this.pokemonDetalhesIndividuais.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.pokemonDetalhesIndividuais()) {
      this.fecharDetalhes();
    }
  }
  alternarTema() {
    this.modoEscuro.update((atual) => !atual);
  }
}