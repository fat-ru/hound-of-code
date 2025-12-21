package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/hound-search/hound/config"
	"github.com/hound-search/hound/index"
	"github.com/hound-search/hound/searcher"
)

// SearcherProvider provides access to searchers
type SearcherProvider interface {
	GetSearchers() map[string]*searcher.Searcher
	AddSearcher(name string, s *searcher.Searcher)
	GetConfig() *config.Config
	GetConfigFile() string
}

const (
	defaultLinesOfContext uint = 2
	maxLinesOfContext     uint = 20
	maxLimit              int  = 100000
)

type Stats struct {
	FilesOpened int
	Duration    int
}

func writeJson(w http.ResponseWriter, data interface{}, status int) {
	w.Header().Set("Content-Type", "application/json;charset=utf-8")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Panicf("Failed to encode JSON: %v\n", err)
	}
}

func writeResp(w http.ResponseWriter, data interface{}) {
	writeJson(w, data, http.StatusOK)
}

func writeError(w http.ResponseWriter, err error, status int) {
	writeJson(w, map[string]string{
		"Error": err.Error(),
	}, status)
}

type searchResponse struct {
	repo string
	res  *index.SearchResponse
	err  error
}

/**
 * Searches all repos in parallel.
 */
func searchAll(
	query string,
	opts *index.SearchOptions,
	repos []string,
	idx map[string]*searcher.Searcher,
	filesOpened *int,
	duration *int) (map[string]*index.SearchResponse, error) {

	startedAt := time.Now()

	n := len(repos)

	// use a buffered channel to avoid routine leaks on errs.
	ch := make(chan *searchResponse, n)
	for _, repo := range repos {
		go func(repo string) {
			fms, err := idx[repo].Search(query, opts)
			ch <- &searchResponse{repo, fms, err}
		}(repo)
	}

	res := map[string]*index.SearchResponse{}
	for i := 0; i < n; i++ {
		r := <-ch
		if r.err != nil {
			return nil, r.err
		}

		if r.res.Matches == nil {
			continue
		}

		res[r.repo] = r.res
		*filesOpened += r.res.FilesOpened
	}

	*duration = int(time.Now().Sub(startedAt).Seconds() * 1000) //nolint

	return res, nil
}

// Used for parsing flags from form values.
func parseAsBool(v string) bool {
	v = strings.ToLower(v)
	return v == "true" || v == "1" || v == "fosho"
}

func parseAsRepoList(v string, idx map[string]*searcher.Searcher) []string {
	v = strings.TrimSpace(v)
	var repos []string
	if v == "*" {
		for repo := range idx {
			repos = append(repos, repo)
		}
		return repos
	}

	for _, repo := range strings.Split(v, ",") {
		if idx[repo] == nil {
			continue
		}
		repos = append(repos, repo)
	}
	return repos
}

func parseAsUintValue(sv string, min, max, def uint) uint {
	iv, err := strconv.ParseUint(sv, 10, 54)
	if err != nil {
		return def
	}
	if max != 0 && uint(iv) > max {
		return max
	}
	if min != 0 && uint(iv) < min {
		return min
	}
	return uint(iv)
}

func parseAsIntValue(sv string, min, max, def int) int {
	iv, err := strconv.ParseInt(sv, 10, 64)
	if err != nil {
		return def
	}
	if max != 0 && int(iv) > max {
		return max
	}
	if min != 0 && int(iv) < min {
		return min
	}
	return int(iv)
}

func parseRangeInt(v string, i *int) {
	*i = 0
	if v == "" {
		return
	}

	vi, err := strconv.ParseUint(v, 10, 64)
	if err != nil {
		return
	}

	*i = int(vi)
}

func parseRangeValue(rv string) (int, int) {
	ix := strings.Index(rv, ":")
	if ix < 0 {
		return 0, 0
	}

	var b, e int
	parseRangeInt(rv[:ix], &b)
	parseRangeInt(rv[ix+1:], &e)
	return b, e
}

func Setup(m *http.ServeMux, provider SearcherProvider, defaultMaxResults int) {
	getIdx := func() map[string]*searcher.Searcher {
		return provider.GetSearchers()
	}

	m.HandleFunc("/api/v1/repos", func(w http.ResponseWriter, r *http.Request) {
		idx := getIdx()
		res := map[string]*config.Repo{}
		for name, srch := range idx {
			res[name] = srch.Repo
		}

		writeResp(w, res)
	})

	m.HandleFunc("/api/v1/search", func(w http.ResponseWriter, r *http.Request) {
		idx := getIdx()
		var opt index.SearchOptions

		stats := parseAsBool(r.FormValue("stats"))
		repos := parseAsRepoList(r.FormValue("repos"), idx)
		query := r.FormValue("q")
		opt.Offset, opt.Limit = parseRangeValue(r.FormValue("rng"))
		opt.FileRegexp = r.FormValue("files")
		opt.ExcludeFileRegexp = r.FormValue("excludeFiles")
		opt.IgnoreCase = parseAsBool(r.FormValue("i"))
		opt.LiteralSearch = parseAsBool(r.FormValue("literal"))
		opt.MaxResults = parseAsIntValue(
			r.FormValue("limit"),
			-1,
			maxLimit,
			defaultMaxResults)
		opt.LinesOfContext = parseAsUintValue(
			r.FormValue("ctx"),
			0,
			maxLinesOfContext,
			defaultLinesOfContext)

		var filesOpened int
		var durationMs int

		results, err := searchAll(query, &opt, repos, idx, &filesOpened, &durationMs)
		if err != nil {
			// TODO(knorton): Return ok status because the UI expects it for now.
			writeError(w, err, http.StatusOK)
			return
		}

		var res struct {
			Results map[string]*index.SearchResponse
			Stats   *Stats `json:",omitempty"`
		}

		res.Results = results
		if stats {
			res.Stats = &Stats{
				FilesOpened: filesOpened,
				Duration:    durationMs,
			}
		}

		writeResp(w, &res)
	})

	m.HandleFunc("/api/v1/excludes", func(w http.ResponseWriter, r *http.Request) {
		idx := getIdx()
		repo := r.FormValue("repo")
		searcher := idx[repo]
		if searcher == nil {
			writeError(w, fmt.Errorf("No such repository: %s", repo), http.StatusNotFound)
			return
		}
		res := searcher.GetExcludedFiles()
		w.Header().Set("Content-Type", "application/json;charset=utf-8")
		w.Header().Set("Access-Control-Allow", "*")
		fmt.Fprint(w, res)
	})

	m.HandleFunc("/api/v1/update", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			writeError(w,
				errors.New(http.StatusText(http.StatusMethodNotAllowed)),
				http.StatusMethodNotAllowed)
			return
		}

		idx := getIdx()
		repos := parseAsRepoList(r.FormValue("repos"), idx)

		for _, repo := range repos {
			searcher := idx[repo]
			if searcher == nil {
				writeError(w,
					fmt.Errorf("No such repository: %s", repo),
					http.StatusNotFound)
				return
			}

			if !searcher.Update() {
				writeError(w,
					fmt.Errorf("Push updates are not enabled for repository %s", repo),
					http.StatusForbidden)
				return

			}
		}

		writeResp(w, "ok")
	})

	m.HandleFunc("/api/v1/repos/add", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			writeError(w,
				errors.New(http.StatusText(http.StatusMethodNotAllowed)),
				http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Name   string `json:"name"`
			Url    string `json:"url"`
			Branch string `json:"branch"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, fmt.Errorf("Invalid request: %v", err), http.StatusBadRequest)
			return
		}

		if req.Name == "" || req.Url == "" {
			writeError(w, errors.New("name and url are required"), http.StatusBadRequest)
			return
		}

		idx := getIdx()
		if idx[req.Name] != nil {
			writeError(w, fmt.Errorf("Repository %s already exists", req.Name), http.StatusConflict)
			return
		}

		cfg := provider.GetConfig()
		if cfg == nil {
			writeError(w, errors.New("Config not available"), http.StatusInternalServerError)
			return
		}

		// Create new repo config
		repo := &config.Repo{
			Url: req.Url,
			Vcs: "git",
		}

		// Set branch if provided
		if req.Branch != "" {
			vcsConfig := map[string]interface{}{
				"ref": req.Branch,
			}
			vcsConfigBytes, err := json.Marshal(vcsConfig)
			if err != nil {
				writeError(w, fmt.Errorf("Failed to create vcs config: %v", err), http.StatusInternalServerError)
				return
			}
			secretMsg := config.SecretMessage(vcsConfigBytes)
			repo.VcsConfigMessage = &secretMsg
		}

		// Initialize repo with defaults
		config.InitRepo(repo)

		// Add to config
		if cfg.Repos == nil {
			cfg.Repos = make(map[string]*config.Repo)
		}
		cfg.Repos[req.Name] = repo

		// Save config file
		configFile := provider.GetConfigFile()
		if configFile == "" {
			configFile = "config.json"
		}
		if err := cfg.SaveToFile(configFile); err != nil {
			writeError(w, fmt.Errorf("Failed to save config: %v", err), http.StatusInternalServerError)
			return
		}

		// Create new searcher
		newSearcher, err := searcher.New(cfg.DbPath, req.Name, repo)
		if err != nil {
			writeError(w, fmt.Errorf("Failed to create searcher: %v", err), http.StatusInternalServerError)
			// Remove from config on error
			delete(cfg.Repos, req.Name)
			cfg.SaveToFile(configFile)
			return
		}

		// Add searcher to server
		provider.AddSearcher(req.Name, newSearcher)

		// Trigger update
		if !newSearcher.Update() {
			// If update fails, log but don't fail the request
			log.Printf("Warning: Failed to trigger update for repository %s", req.Name)
		}

		writeResp(w, map[string]string{
			"status":  "ok",
			"message": fmt.Sprintf("Repository %s added successfully", req.Name),
		})
	})

	m.HandleFunc("/api/v1/github-webhook", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			writeError(w,
				errors.New(http.StatusText(http.StatusMethodNotAllowed)),
				http.StatusMethodNotAllowed)
			return
		}

		type Webhook struct {
			Repository struct {
				Name      string
				Full_name string
			}
		}

		var h Webhook

		err := json.NewDecoder(r.Body).Decode(&h)

		if err != nil {
			writeError(w,
				errors.New(http.StatusText(http.StatusBadRequest)),
				http.StatusBadRequest)
			return
		}

		repo := h.Repository.Full_name
		idx := getIdx()
		searcher := idx[h.Repository.Full_name]

		if searcher == nil {
			writeError(w,
				fmt.Errorf("No such repository: %s", repo),
				http.StatusNotFound)
			return
		}

		if !searcher.Update() {
			writeError(w,
				fmt.Errorf("Push updates are not enabled for repository %s", repo),
				http.StatusForbidden)
			return
		}

		writeResp(w, "ok")
	})
}
